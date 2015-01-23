/* AVR simulation code for pichai.

 This file is part of pichai.

 pichai is free software; you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free
 Software Foundation; either version 3, or (at your option) any later
 version.

 pichai is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or
 FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 for more details.

 You should have received a copy of the GNU General Public License
 along with pichai; see the file LICENSE.  If not see
 <http://www.gnu.org/licenses/>.  */

var timedInstructions, scalerTicks = 64, timerInterrupt = 92, TCNT0 = 70, TIFR0 = 53, ADCSRA = 122, ADCH = 121, ADCL = 120, SP = 95, SPH = 94, SPL = 93, r = Array(32), calculatedOffset = 0, SREG, C = 0, Z = 0, N = 0, V = 0, S = 0, H = 0, T = 0, I = 0, dataQueueB = [], dataQueueC = [], dataQueueD = [], dataQueueE = [], dataQueueF = [], pixelQueue = [], softBreakpoints = [], isPaused = !0, forceBreak = !1, hasDeviceSignature = !1, simulationManufacturerID = 191, uartBufferLength = 32, sdr, spsr, udr, ucsra, ucsrb, udri, memory,
flashStart, dataStart, dataEnd, ioRegStart, portB, pinB = 57005, pinBTimer, portC, pinC = 57005, pinCTimer, portD, pinD = 57005, pinDTimer, portE, pinE = 57005, pinETimer, portF, pinF = 57005, pinFTimer, pllCsr, bitsPerPort, vectorBase, usbVectorBase, signatureOffset, jumpTableAddress, mainAddress, PC, optimizationEnabled, forceOptimizationEnabled = !1, disableUARTInterrupt = !1, batchSize = 1E4, inputCycles = 2E5, batchDelay = 0, adcValue = 42, disableHardware = !1, nativeFlag, spipinport1, spipinport2;
function initScreen() {
}
function writeDMARegion(c, b) {
}
function peripheralSPIWrite(c) {
}
function uartWrite(c) {
}
function drawPixel(c, b, d) {
}
function refreshScreen() {
}
function reportMhz(mhz) {
}
function flushPixelBuffer() {
  if(0 < pixelQueue.length)
  {
    if(isNative())
    {
      Android.writePixelBuffer(JSON.stringify(pixelQueue));
    }
    else
    {
      refreshScreen();
    }
    pixelQueue.length = 0;
  }
}
function popPortBuffer(c, b) {
  isNode() && console.log(c[0]);
  c.shift();
}
function setPin(c, b) {
}
function handlePinInput( pinNumber )
{
    var mask = 0x00;
    var inputPort = 0;
    if( pinNumber >= 0 && pinNumber < 8 )
    {
        inputPort = pinB;
        mask = 1 << pinNumber;
        pinBTimer = inputCycles;
    }
    if( pinNumber >= 8 && pinNumber < 16 )
    {
        inputPort = pinC;
        mask = 1 << (pinNumber - 8);
        pinCTimer = inputCycles;
    }
    if( pinNumber >= 16 && pinNumber < 24 )
    {
        inputPort = pinD;
        mask = 1 << (pinNumber - 16);
        pinDTimer = inputCycles;
    }
    if( pinNumber >= 24 && pinNumber < 32 )
    {
        inputPort = pinE;
        mask = 1 << (pinNumber - 24);
        pinETimer = inputCycles;
    }
    if( pinNumber >= 32 && pinNumber < 40 )
    {
        inputPort = pinF;
        mask = 1 << (pinNumber - 32);
        pinFTimer = inputCycles;
     }
     writeMemory(inputPort, mask);
}
function getStackDump() {
  for (var c = " ", b = SP;b < flashStart;) {
    c += "0x" + readMemory(b).toString(16).toUpperCase() + " ", b++;
  }
  return c;
}
function setDebugResult(c) {
  isNative() && Android.setDebugResult(c);
}
function getDecodedBytes(b, a) {
  for (var e = 0;;) {
    var d = b[a++];
    e++;
    if (0 == (d & 128)) {
      break;
    }
  }
  return e;
}
function decode(b, a) {
  for (var e = 0, d = 0;;) {
    var g = b[a++], e = e | (g & 127) << d;
    if (0 == (g & 128)) {
      break;
    }
    d += 7;
  }
  return e;
}

function addressInStack(address){
    return (address < flashStart) && (address > 0x100); // StackEnd 32u4 / 328
}

function addressInProgram(address){
    return (address > flashStart) && (address < 0x7E00); // Arduino Uno Application flash
}

var CFA = 0;
var rows = Array(37);
var grabRegisters = true;
function backtrace(address) {
  if(grabRegisters)
  {
    var reg = 0
    while(reg < 32)
      rows[reg] = r[reg++];
    rows[32] = SP;
  }
  else
  {
    rows[32] = CFA;
  }
  var CFAOffset = 0;
  CFA = rows[32] + 2;
  rows[36] = CFA -1;

  var found = false;
  var i = 0;
  while(i < frames.length)
  {
    var adjustedAddress = address - flashStart;
    if(adjustedAddress >= frames[i].start && adjustedAddress < frames[i].start+frames[i].range)
    {
      found = true;
      break;
    }
    else
      i++;
  }
  console.log(getDecodedLine(address));
  if(found)
  {
    grabRegisters = false;
    var j = 0;
    var frame = frames[i];
    var location = frame.start;
    while(j < frame.instructions.length)
    {
      var current = frame.instructions[j];
      var value = current & 0x3F;
      if((current >> 6) > 0)
      {
        switch(current >> 6)
        {
          case 1:
            location += value*2;
            j++;
            break;
          case 2:
            j++
            rows[value] = CFA-decode(frame.instructions, j);
            j+=getDecodedBytes(frame.instructions, j);
            break;
          case 3:
          default:
            throw "Unknown state";
        }
        continue;
      }
      switch(value)
      {
        case 0:
          j++;
          break;
        case 13:
          j++;
          CFA = rows[decode(frame.instructions, j)];
          j+=getDecodedBytes(frame.instructions, j);
          break;
        case 14:
          j++;
          CFAOffset = decode(frame.instructions, j);
          j+=getDecodedBytes(frame.instructions, j);
          break;
        default:
          throw "Unimplemented CFA instruction";
      }
    }
    CFA += CFAOffset;
    var cursor = CFA;
    var returnAddr = readMemory(cursor) | readMemory(cursor-1) << 8;
    while( !addressInStack(returnAddr) && !addressInProgram(returnAddr) && (cursor > (r[28] | r[29] << 8)) )
    {
      cursor-=2;
      returnAddr = readMemory(cursor) | readMemory(cursor-1) << 8;
    }
    if(addressInStack(returnAddr))
    {
      returnAddr = readMemory(returnAddr) | readMemory(returnAddr-1) << 8;
    }
    if(addressInProgram(returnAddr))
    {
        if(returnAddr != address)
	  backtrace(returnAddr);
    }
  }
  else
  {
    grabRegisters = true;
  }
}
function getDecodedLine(address) {
  var info;
  var offset = 0;
  while( "undefined" == typeof info && address > flashStart && offset < 128 )
    info = sourceLines[address - flashStart - offset++];
  if( "undefined" == typeof info )
    info = "$PC = 0x" + (address - flashStart).toString(16);
  return info;
}
function handleDebugCommandString(c) {
  if ("x" == c.substring(0, 1)) {
    var b = readMemory(parseInt(c.substring(2), 16)).toString(16);
    setDebugResult(c.substring(1) + ": 0x" + b.substring(0, 2));
  } else {
    "p" == c.substring(0, 1) ? (b = 0, "$PC" == c.substring(2) ? b = (PC - flashStart).toString(16) : "$SREG" == c.substring(2) ? b = readMemory(SREG).toString(16) : "$SP" == c.substring(2) ? b = readMemory(SPH).toString(16) + readMemory(SPL).toString(16) : "$r" == c.substring(2, 4) && (b = r[parseInt(c.substring(4), 10)].toString(16)), setDebugResult(c.substring(2) + " = 0x" + b)) : "c" == c.substring(0, 1) ? (setDebugResult("Continuing"), exec()) : "s" == c.substring(0, 1) ? (forceBreak = !0, exec(), 
    setDebugResult(getDecodedLine(PC)), backtrace(PC)) : "delete" == c ? (softBreakpoints = [], setDebugResult("Cleared Breakpoints")) : "break" == c.substring(0, 5) && "*" == c.substring(6, 7) && softBreakpoints.push(parseInt(c.substring(7), 16));
  }
}
function initCore() {
  "attiny4" === target ? (memory = Array(17408), flashStart = 16384, dataStart = 64, dataEnd = 96, ioRegStart = 0, portB = 2, spr = 16894, udr = 16895, bitsPerPort = 4, SPH = 62, SPL = 61, spsr = udri = ucsra = ucsrb = spmCr = pllCsr = portF = portE = portD = portC = 57005) : "atmega8" === target ? (memory = Array(8192), flashStart = 1120, dataStart = 96, dataEnd = 1120, ioRegStart = 32, portB = 56, portC = 53, portD = 50, spmCr = 87, sdr = 47, spsr = 46, udr = 44, udri = 24, ucsra = 43, ucsrb = 
  42, bitsPerPort = 8, pllCsr = portF = portE = 57005) : "atmega32u4" === target ? (memory = Array(32768), flashStart = 2816, dataStart = 256, dataEnd = 2816, ioRegStart = 32, portB = 37, pinB = 35, portC = 40, pinC = 38, portD = 43, pinD = 41, portE = 46, pinE = 44, portF = 49, pinF = 47, spmCr = 87, sdr = 78, spsr = 77, udr = 206, udri = 104, ucsra = 200, ucsrb = 201, pllCsr = 73, bitsPerPort = 8, SP = 2815, spipinport1 = 2, spipinport2 = 3, DMA = 32758) : "atmega328" === target ? (scalerTicks = 4, memory = Array(32768), spipinport1 = 1, spipinport2 = 1, timerInterrupt = 64, flashStart = 2304, dataStart = 256, dataEnd = 2304, SP = 2303, DMA = 32758, ioRegStart = 32, portB = 37, pinB = 35, portC = 40, pinC = 38, portD = 43, pinD = 41, portE = pinE = portF = pinF = 57005, spmCr = 87, sdr = 78, spsr = 77, udr = 198, udri = 76, ucsra = 192, ucsrb = 193, pllCsr = 57005, bitsPerPort = 8) : alert("Failed! Unknown target");
  optimizationEnabled = !1;
  PC = flashStart;
  SREG = ioRegStart + 63;
  vectorBase = flashStart + 172;
  usbVectorBase = vectorBase + 430;
  signatureOffset = flashStart + 176;
  jumpTableAddress = usbVectorBase + 64;
  mainAddress = usbVectorBase + 72;
  for (a = 0;a < memory.length;a++) {
    disableHardware = !0, a != sdr && writeMemory(a, 0), disableHardware = !1;
  }
  memory[ucsra] = 32;
  memory[ucsrb] = 32;
  memory[spsr] = 128;
  "attiny4" === target && (memory[16320] = simulationManufacturerID, memory[16321] = 143, memory[16322] = 10);
}
function writeClockRegister(c) {
  memory[pllCsr] = 0 < (c & 2) ? memory[pllCsr] | 1 : memory[pllCsr] & 254;
}
function writeControlRegister(c) {
  33 === c && writeMemory((r[31] << 8 | r[30]) + flashStart, simulationManufacturerID.toString(16));
  memory[spmCr] = c;
}
function isNative() {
  isNode() || "undefined" != typeof nativeFlag || (nativeFlag = navigator.userAgent.indexOf("NativeApp"));
  return!isNode() && -1 != nativeFlag;
}
function isNode() {
  return "undefined" === typeof navigator;
}
function writeADCDataRegister(c) {
  isNative() && (adcValue = c);
}
function writeUARTDataRegister(c) {
  memory[udr] = c;
  if(c){
  uartWrite(c);
  isNative() && Android.writeUARTBuffer(c);
  }
  memory[udr] = 0;
}
function writeSPIDataRegister(c) {
  memory[sdr] = c;
  peripheralSPIWrite(c);
}
function callUARTInterrupt() {
  writeMemory(SP--, PC >> 8);
  writeMemory(SP--, PC & 255);
  PC = udri + flashStart;
}
function callTOV0Interrupt() {
  writeMemory(SP--, PC >> 8);
  writeMemory(SP--, PC & 255);
  PC = timerInterrupt + flashStart;
}
function writeSpecificPort(c) {
  var b, d = 8 * c;
  switch(c) {
    case 0:
      b = dataQueueB;
      isNode() && console.log("PortB");
      break;
    case 1:
      b = dataQueueC;
      isNode() && console.log("PortC");
      break;
    case 2:
      b = dataQueueD;
      isNode() && console.log("PortD");
      break;
    case 3:
      b = dataQueueE;
      isNode() && console.log("PortE");
      break;
    case 4:
      b = dataQueueF, isNode() && console.log("PortF");
  }
  isNative() && (!forceOptimizationEnabled || 8 * spipinport1 != d && 8 * spipinport2 != d) && Android.writePort(c, b[0]);
  popPortBuffer(b, d);
}
function writeMemory(c, b) {
  memory[c] = b;
  if(c == ucsra)
    memory[c] |= 32;
  disableHardware || (c == portB && dataQueueB.push(b), c == portC && dataQueueC.push(b), c == portD && dataQueueD.push(b), c == portE && dataQueueE.push(b), c == portF && dataQueueF.push(b), c == udr && writeUARTDataRegister(b), c == sdr && writeSPIDataRegister(b), !disableUARTInterrupt && c == ucsra && memory[ucsrb] & 32 && b & 64 && callUARTInterrupt(), c >= DMA && writeDMARegion(c, b));
  c == pllCsr && writeClockRegister(b);
  c == spmCr && writeControlRegister(b);
  if (c == SPH || c == SPL) {
    SP = memory[SPH] << 8 | memory[SPL];
  }
}
function readMemory(c) {
  if (c === TCNT0) {
    var overflow = Math.ceil(timedInstructions / (scalerTicks*256));
    for (var b = 0; (overflow & 0x3FF) > b;b++) {
      callTOV0Interrupt();
    }
    timedInstructions = 0;
  }
  if (c === TIFR0) {
    return 1;
  }
  c === ADCH && isNative() && Android.updateADCRegister();
  return c === SREG ? C | Z << 1 | N << 2 | V << 3 | S << 4 | H << 5 | T << 6 | I << 7 : c === SPH ? SP >> 8 : c === SPL ? SP & 255 : c === ADCL ? adcValue & 255 : c === ADCH ? adcValue >> 8 : memory[c];
}
function loadMemory(c, b) {
  initCore();
  c = b ? c.split(/["|"]/) : c.split(/["\n"]/);
  for (var d = 0;c[d];) {
    var h = c[d].substring(1), e = parseInt(h.substring(2, 6), 16), f = 0;
    for (j = 4;j < parseInt(h.substring(0, 2), 16) + 4;j += 2) {
      var g = 2 * j, g = h.substring(g, g + 4);
      writeMemory(flashStart + e + f, g.substring(0, 2));
      writeMemory(flashStart + e + f + 1, g.substring(2));
      f += 2;
    }
    d++;
  }
}
function setHFlag(c, b) {
  H = 15 < c + b ? 1 : 0;
}
function setAddPreEvaluationFlags(c, b) {
  setHFlag(c, b);
  var d = c + b;
  V = (c & b & ~d | ~c & ~b & d) >> 7 & 1;
}
function setSubPreEvaluationFlags(c, b) {
  setHFlag(c, b);
  var d = c - b;
  V = (c & ~b & ~d | ~c & b & d) >> 7 & 1;
}
function setWidePreEvaluationFlags(c, b) {
  H = 15 < c + b ? 1 : 0;
  V = 32767 < c && 32767 < b && 32768 > (c + b & 65535);
  V = 32767 > c && 32767 > b && 32768 < (c + b & 65535);
}
function setPostEvaluationFlags(c) {
  255 < c ? (C = 1, c &= 255) : C = 0;
  Z = 0 === c ? 1 : 0;
  N = 128 === (128 & c) || 0 > c ? 1 : 0;
  S = N ^ V;
}
function getBreakDistance(c, b) {
  return(c & 3) << 5 | (b & 240) >> 3 | (b & 8) >> 3;
}
function getRegister(c, b) {
  return ioRegStart + ((b & 248) >> 3);
}
function getRegisterValue(c, b) {
  return b & 7;
}
function getIOValue(c, b) {
  return ioRegStart + ((c & 6) >> 1 << 4 | b & 15);
}
function getJumpConstant(c, b) {
  return(c & 15) << 8 | b;
}
function getBigConstant(c, b) {
  return(c & 15) << 4 | b & 15;
}
function getSmallDestinationRegister(c, b) {
  return((b & 240) >> 4) + 16;
}
function getSmallSourceRegister(c, b) {
  return(b & 15) + 16;
}
function getConstant(c, b) {
  return(b & 192) >> 2 | b & 15;
}
function getUpperPair(c, b) {
  return 2 * ((b & 48) >> 4) + 24;
}
function getDisplacement(c, b) {
  return c & 32 | (c & 12) << 1 | b & 7;
}
function handleInput(c) {
  if (57005 != c) {
    var b = !1;
    switch(c) {
      case pinB:
        b = pinBTimer ? pinBTimer-- : !1;
        break;
      case pinC:
        b = pinCTimer ? pinCTimer-- : !1;
        break;
      case pinD:
        b = pinDTimer ? pinDTimer-- : !1;
        break;
      case pinE:
        b = pinETimer ? pinETimer-- : !1;
        break;
      case pinF:
        b = pinFTimer ? pinFTimer-- : !1;
    }
    if(b == 1)
      writeMemory(c, 0);
  }
}
function fetch(c, b) {
  var d = 16 * (c & 1) + ((b & 240) >> 4), h = 16 * ((c & 2) >> 1) + (b & 15);
  if (128 > c) {
    switch(c) {
      case 1:
        var e = 2 * ((b & 240) >> 4), f = 2 * (b & 15);
        r[e] = r[f];
        r[e + 1] = r[f + 1];
        break;
      case 2:
      ;
      case 3:
        var f = getSmallDestinationRegister(c, b), g = getSmallSourceRegister(c, b), e = !1;
        3 === c && (e = 24 <= f || 24 <= g, f &= 23, g &= 23);
        f = r[f] * r[g];
        e && (f >>= 1);
        r[0] = f & 255;
        r[1] = (f & 65280) >> 8;
        break;
      case 4:
      ;
      case 5:
      ;
      case 6:
      ;
      case 7:
        H = 0;
        e = Z;
        f = r[d] - r[h] - C;
        setAddPreEvaluationFlags(r[d], r[h] + C);
        g = C;
        setPostEvaluationFlags(f);
        Z = 0 === f ? e : 0;
        C = Math.abs(r[h] + g) > Math.abs(r[d]);
        break;
      case 8:
      ;
      case 9:
      ;
      case 10:
      ;
      case 11:
        setSubPreEvaluationFlags(r[d], r[h] + C);
        g = C;
        C = Math.abs(r[h] + g) > Math.abs(r[d]);
        r[d] = r[d] - r[h] - g;
        g = C;
        setPostEvaluationFlags(f);
        setPostEvaluationFlags(r[d]);
        C = g;
        break;
      case 12:
      ;
      case 13:
      ;
      case 14:
      ;
      case 15:
        setAddPreEvaluationFlags(r[d], r[h]);
        r[d] += r[h];
        setPostEvaluationFlags(r[d]);
        break;
      case 16:
      ;
      case 17:
      ;
      case 18:
      ;
      case 19:
        r[d] === r[h] && (PC += 2, e = parseInt(memory[PC - 2], 16), f = parseInt(memory[PC - 1], 16), 12 <= e && 148 == f | 149 == f && (PC += 2), 16 <= e | 0 == e && 144 == f | 145 == f && (PC += 2), 16 <= e | 0 == e && 146 == f | 147 == f && (PC += 2));
        break;
      case 20:
      ;
      case 21:
      ;
      case 22:
      ;
      case 23:
        setSubPreEvaluationFlags(r[d], r[h]);
        setPostEvaluationFlags(r[d] - r[h]);
        C = Math.abs(r[h]) > Math.abs(r[d]);
        break;
      case 24:
      ;
      case 25:
      ;
      case 26:
      ;
      case 27:
        setAddPreEvaluationFlags(r[d], r[h]);
        r[d] -= r[h];
        0 > r[d] ? (r[d] += 255, C = 1) : C = 0;
        g = C;
        setPostEvaluationFlags(r[d]);
        C = g;
        break;
      case 28:
      ;
      case 29:
      ;
      case 30:
      ;
      case 31:
        setAddPreEvaluationFlags(r[d], r[h]);
        r[d] = r[d] + r[h] + C;
        setPostEvaluationFlags(r[d]);
        break;
      case 32:
      ;
      case 33:
      ;
      case 34:
      ;
      case 35:
        H = 0;
        r[d] &= r[h];
        setPostEvaluationFlags(r[d]);
        V = C = 0;
        S = N ^ V;
        break;
      case 36:
      ;
      case 37:
      ;
      case 38:
      ;
      case 39:
        r[d] ^= r[h];
        V = S = N = 0;
        Z = 1;
        break;
      case 40:
      ;
      case 41:
      ;
      case 42:
      ;
      case 43:
        r[d] |= r[h];
        Z = 0 == r[d];
        V = 0;
        N = 128 <= r[d];
        S = N ^ V;
        break;
      case 44:
      ;
      case 45:
      ;
      case 46:
      ;
      case 47:
        r[d] = r[h];
        break;
      case 48:
      ;
      case 49:
      ;
      case 50:
      ;
      case 51:
      ;
      case 52:
      ;
      case 53:
      ;
      case 54:
      ;
      case 55:
      ;
      case 56:
      ;
      case 57:
      ;
      case 58:
      ;
      case 59:
      ;
      case 60:
      ;
      case 61:
      ;
      case 62:
      ;
      case 63:
        H = 0;
        setAddPreEvaluationFlags(r[getSmallDestinationRegister(c, b)], getBigConstant(c, b));
        setPostEvaluationFlags(r[getSmallDestinationRegister(c, b)] - getBigConstant(c, b));
        C = Math.abs(getBigConstant(c, b)) > Math.abs(r[getSmallDestinationRegister(c, b)]);
        break;
      case 64:
      ;
      case 65:
      ;
      case 66:
      ;
      case 67:
      ;
      case 68:
      ;
      case 69:
      ;
      case 70:
      ;
      case 71:
      ;
      case 72:
      ;
      case 73:
      ;
      case 74:
      ;
      case 75:
      ;
      case 76:
      ;
      case 77:
      ;
      case 78:
      ;
      case 79:
        f = getSmallDestinationRegister(c, b);
        setSubPreEvaluationFlags(r[f], getBigConstant(c, b) + C);
        r[f] -= getBigConstant(c, b) + C;
        var OldZ = Z;
        setPostEvaluationFlags(r[f]);
        Z = OldZ;
        0 != r[f] && (Z = 0);
        for (C = 0;0 > r[f];) {
          r[f] = 256 + r[f], C = 1;
        }
        break;
      case 80:
      ;
      case 81:
      ;
      case 82:
      ;
      case 83:
      ;
      case 84:
      ;
      case 85:
      ;
      case 86:
      ;
      case 87:
      ;
      case 88:
      ;
      case 89:
      ;
      case 90:
      ;
      case 91:
      ;
      case 92:
      ;
      case 93:
      ;
      case 94:
      ;
      case 95:
        f = getSmallDestinationRegister(c, b);
        setAddPreEvaluationFlags(r[f], getBigConstant(c, b));
        r[f] -= getBigConstant(c, b);
        setPostEvaluationFlags(r[f]);
        for (C = 0;0 > r[f];) {
          r[f] = 256 + r[f], C = 1;
        }
        break;
      case 96:
      ;
      case 97:
      ;
      case 98:
      ;
      case 99:
      ;
      case 100:
      ;
      case 101:
      ;
      case 102:
      ;
      case 103:
      ;
      case 104:
      ;
      case 105:
      ;
      case 106:
      ;
      case 107:
      ;
      case 108:
      ;
      case 109:
      ;
      case 110:
      ;
      case 111:
        f = getSmallDestinationRegister(c, b);
        r[f] |= getBigConstant(c, b);
        V = 0;
        Z = 0 == r[f];
        N = 128 <= r[f];
        S = N ^ V;
        break;
      case 112:
      ;
      case 113:
      ;
      case 114:
      ;
      case 115:
      ;
      case 116:
      ;
      case 117:
      ;
      case 118:
      ;
      case 119:
      ;
      case 120:
      ;
      case 121:
      ;
      case 122:
      ;
      case 123:
      ;
      case 124:
      ;
      case 125:
      ;
      case 126:
      ;
      case 127:
        H = 0, f = getSmallDestinationRegister(c, b), r[f] &= getBigConstant(c, b), setPostEvaluationFlags(r[f]), V = C = 0;
    }
  } else {
    if (128 <= c && 256 > c) {
      switch(c) {
        case 128:
        ;
        case 129:
          if (8 <= (b & 15)) {
            r[d] = readMemory((r[29] << 8 | r[28]) + getDisplacement(c, b));
            break;
          }
          if (8 > (b & 15) && 0 <= (b & 15)) {
            r[d] = readMemory((r[31] << 8 | r[30]) + getDisplacement(c, b));
            break;
          }
          0 === (b & 15) ? r[d] = readMemory(r[31] << 8 | r[30]) : r[d] = readMemory(r[29] << 8 | r[28]);
          break;
        case 130:
        ;
        case 131:
          if (8 <= (b & 15)) {
            writeMemory((r[29] << 8 | r[28]) + getDisplacement(c, b), r[d]);
            break;
          }
          if (8 > (b & 15) && 0 <= (b & 15)) {
            writeMemory((r[31] << 8 | r[30]) + getDisplacement(c, b), r[d]);
            break;
          }
          8 === (b & 15) && writeMemory(r[29] << 8 | r[28], r[d]);
          0 === (b & 15) && writeMemory(r[31] << 8 | r[30], r[d]);
          break;
        case 132:
        ;
        case 133:
        ;
        case 136:
        ;
        case 137:
        ;
        case 140:
        ;
        case 141:
          if (8 <= (b & 15)) {
            r[d] = readMemory((r[29] << 8 | r[28]) + getDisplacement(c, b));
            break;
          }
          if (8 > (b & 15) && 0 <= (b & 15)) {
            r[d] = readMemory((r[31] << 8 | r[30]) + getDisplacement(c, b));
            break;
          }
          break;
        case 134:
        ;
        case 135:
        ;
        case 138:
        ;
        case 139:
        ;
        case 142:
        ;
        case 143:
          if (8 <= (b & 15)) {
            writeMemory((r[29] << 8 | r[28]) + getDisplacement(c, b), r[d]);
            break;
          }
          if (8 > (b & 15) && 0 <= (b & 15)) {
            writeMemory((r[31] << 8 | r[30]) + getDisplacement(c, b), r[d]);
            break;
          }
          break;
        case 144:
        ;
        case 145:
          15 === (b & 15) ? r[d] = readMemory(++SP) : 4 === (b & 15) || 5 === (b & 15) ? (e = r[31] << 8 | r[30], g = 2 * (e >> 1) + flashStart, f = parseInt(readMemory(g), 16), g = parseInt(readMemory(g + 1), 16), r[d] = 0 === (e & 1) ? f : g, 5 === (b & 15) && (r[30]++, 256 === r[30] && (r[30] = 0, r[31]++))) : 1 === (b & 15) ? (r[d] = readMemory(r[31] << 8 | r[30]), r[30] += 1, 256 == r[30] && (r[30] = 0, r[31] += 1)) : 2 === (b & 15) ? (--r[30], 0 > r[30] && (r[30] = 0, --r[31]), r[d] = readMemory(r[31] << 
          8 | r[30])) : 13 === (b & 15) ? (r[d] = readMemory(r[27] << 8 | r[26]), r[26] += 1, 256 == r[26] && (r[26] = 0, r[27] += 1)) : 14 === (b & 15) ? (--r[26], 0 > r[26] && (r[26] = 0, --r[27]), r[d] = readMemory(r[27] << 8 | r[26])) : r[d] = 12 === (b & 15) ? readMemory(r[27] << 8 | r[26]) : readMemory(parseInt(readMemory(PC++), 16) | parseInt(readMemory(PC++), 16) << 8);
          break;
        case 146:
        ;
        case 147:
          1 === (b & 15) && (writeMemory(r[31] << 8 | r[30], r[d]), r[30] += 1, 256 == r[30] && (r[30] = 0, r[31] += 1));
          2 === (b & 15) && (--r[30], 0 > r[30] && (r[30] = 255, --r[31]), writeMemory(r[31] << 8 | r[30], r[d]));
          9 === (b & 15) && (writeMemory(r[29] << 8 | r[28], r[d]), r[28] += 1, 256 == r[28] && (r[28] = 0, r[29] += 1));
          10 === (b & 15) && (--r[28], 0 > r[28] && (r[28] = 255, --r[29]), writeMemory(r[29] << 8 | r[28], r[d]));
          14 === (b & 15) && (--r[26], 0 > r[26] && (r[26] = 255, --r[27]), writeMemory(r[27] << 8 | r[26], r[d]));
          15 === (b & 15) ? (writeMemory(SP, r[d]), SP--) : 0 === (b & 15) ? writeMemory(parseInt(memory[PC++], 16) | parseInt(memory[PC++], 16) << 8, r[d]) : 12 === (b & 15) ? (e = parseInt(r[26]), f = parseInt(r[27]) << 8, writeMemory(f | e, r[d])) : 13 === (b & 15) && (e = parseInt(r[26]), f = parseInt(r[27]) << 8, writeMemory(f | e, r[d]), r[26]++, 256 === r[26] && (r[26] = 0, r[27]++));
          break;
        case 148:
        ;
        case 149:
          0 === (b & 15) && (r[d] = 255 - r[d], C = 1, V = 0, Z = 0 == r[d], S = N ^ V);
          1 === (b & 15) && (r[d] = 0 - r[d], 0 == r[d] ? C = 0 : C = 1);
          if (7 === (b & 15)) {
            e = r[d] & 1, r[d] >>= 1, C && (r[d] |= 128), C = e;
          } else {
            if (2 === (b & 15)) {
              r[d] = r[d] << 4 | r[d] >> 4;
            } else {
              if (3 === (b & 15)) {
                V = 127 == r[d], r[d] += 1;
              } else {
                if (5 === (b & 15)) {
                  e = r[d], g = e & 1, e = e >> 1 | e & 128, setPostEvaluationFlags(e), r[d] = e, C = g, V = N ^ C;
                } else {
                  if (6 === (b & 15)) {
                    C = r[d] & 1, r[d] >>= 1, N = 0, V = N ^ C, Z = 0 == r[d];
                  } else {
                    if (8 === (b & 255) && 148 === c) {
                      C = 1;
                    } else {
                      if (9 === (b & 255) && 148 === c) {
                        PC = 2 * (r[31] << 8 | r[30]) + flashStart;
                      } else {
                        if (24 === (b & 255) && 148 === c) {
                          Z = 1;
                        } else {
                          if (40 === (b & 255) && 148 === c) {
                            N = 1;
                          } else {
                            if (56 === (b & 255) && 148 === c) {
                              V = 1;
                            } else {
                              if (72 === (b & 255) && 148 === c) {
                                S = 1;
                              } else {
                                if (88 === (b & 255) && 148 === c) {
                                  H = 1;
                                } else {
                                  if (104 === (b & 255) && 148 === c) {
                                    T = 1;
                                  } else {
                                    if (120 === (b & 255) && 148 === c) {
                                      I = 1;
                                    } else {
                                      if (136 === (b & 255) && 148 === c) {
                                        C = 0;
                                      } else {
                                        if (152 === (b & 255) && 148 === c) {
                                          Z = 0;
                                        } else {
                                          if (168 === (b & 255) && 148 === c) {
                                            N = 0;
                                          } else {
                                            if (184 === (b & 255) && 148 === c) {
                                              V = 0;
                                            } else {
                                              if (200 === (b & 255) && 148 === c) {
                                                S = 0;
                                              } else {
                                                if (216 === (b & 255) && 148 === c) {
                                                  H = 0;
                                                } else {
                                                  if (232 === (b & 255) && 148 === c) {
                                                    T = 0;
                                                  } else {
                                                    if (248 === (b & 255) && 148 === c) {
                                                      I = 0;
                                                    } else {
                                                      if (8 === (b & 255) && 149 === c) {
                                                        f = memory[++SP], PC = f << 8 | memory[++SP];
                                                      } else {
                                                        if (136 === (b & 255) && 149 === c) {
                                                          break;
                                                        } else {
                                                          if (168 === (b & 255) && 149 === c) {
                                                            break;
                                                          } else {
                                                            9 === (b & 255) ? (writeMemory(SP--, PC & 255), writeMemory(SP--, PC >> 8), PC = 2 * (r[31] << 8 | r[30]) + flashStart) : 10 === (b & 15) ? (V = 128 == r[d], --r[d], N = 0 < (r[d] & 128), Z = 0 == r[d]) : 12 === (b & 15) || 13 === (b & 15) ? PC = flashStart + 2 * ((c & 1) << 20 | (b & 240) << 17 | (b & 1) << 16 | parseInt(memory[PC + 1], 16) << 8 | parseInt(memory[PC], 16)) : 14 === (b & 15) || 15 === (b & 15) ? (writeMemory(SP--, PC + 2 & 
                                                            255), writeMemory(SP--, PC + 2 >> 8), PC = flashStart + 2 * (parseInt(memory[PC + 1], 16) << 8 | parseInt(memory[PC], 16))) : 24 === (b & 255) && 149 === c && (PC = readMemory(++SP) | readMemory(++SP) << 8);
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          break;
        case 150:
          H = 0;
          e = getConstant(c, b);
          f = getUpperPair(c, b);
          g = r[f + 1] << 8 | r[f];
          setWidePreEvaluationFlags(g, e);
          g += e;
          r[f] = g & 255;
          r[f + 1] = g >> 8;
          setPostEvaluationFlags(65535 < g);
          Z = 0 == g;
          break;
        case 151:
          H = 0;
          e = getConstant(c, b);
          f = getUpperPair(c, b);
          g = r[f + 1] << 8 | r[f];
          setWidePreEvaluationFlags(g, e);
          g -= e;
          r[f] = g & 255;
          r[f + 1] = g >> 8;
          setPostEvaluationFlags(g);
          Z = 0 == g;
          break;
        case 152:
          e = getRegister(c, b);
          f = getRegisterValue(c, b);
          0 < (memory[e] & 1 << f) && writeMemory(e, memory[e] ^ 1 << f);
          break;
        case 153:
          0 == (memory[getRegister(c, b)] & 1 << getRegisterValue(c, b)) && (PC += 2), e = parseInt(memory[PC - 2], 16), f = parseInt(memory[PC - 1], 16), 12 <= e && 148 == f | 149 == f && (PC += 2), 16 <= e | 0 == e && 144 == f | 145 == f && (PC += 2), 16 <= e | 0 == e && 146 == f | 147 == f && (PC += 2);
        case 154:
          e = getRegister(c, b);
          writeMemory(e, memory[e] | 1 << getRegisterValue(c, b));
          break;
        case 155:
          0 < (readMemory(getRegister(c, b)) & 1 << getRegisterValue(c, b)) && (PC += 2);
          e = parseInt(memory[PC - 2], 16);
          f = parseInt(memory[PC - 1], 16);
          12 <= e && 148 == f | 149 == f && (PC += 2);
          16 <= e | 0 == e && 144 == f | 145 == f && (PC += 2);
          16 <= e | 0 == e && 146 == f | 147 == f && (PC += 2);
          break;
        case 156:
        ;
        case 157:
        ;
        case 158:
        ;
        case 159:
          f = r[d] * r[h];
          r[0] = f & 255;
          r[1] = (f & 65280) >> 8;
          break;
        case 160:
        ;
        case 161:
        ;
        case 164:
        ;
        case 165:
        ;
        case 168:
        ;
        case 169:
        ;
        case 172:
        ;
        case 173:
          8 <= (b & 15) && (r[d] = readMemory((r[29] << 8 | r[28]) + getDisplacement(c, b)));
          8 > (b & 15) && 0 < (b & 15) && (r[d] = readMemory((r[31] << 8 | r[30]) + getDisplacement(c, b)));
          break;
        case 162:
        ;
        case 163:
        ;
        case 166:
        ;
        case 167:
        ;
        case 170:
        ;
        case 171:
        ;
        case 174:
        ;
        case 175:
          8 <= (b & 15) && writeMemory((r[29] << 8 | r[28]) + getDisplacement(c, b), r[d]);
          8 > (b & 15) && 0 < (b & 15) && writeMemory((r[31] << 8 | r[30]) + getDisplacement(c, b), r[d]);
          break;
        case 176:
        ;
        case 177:
        ;
        case 178:
        ;
        case 179:
        ;
        case 180:
        ;
        case 181:
        ;
        case 182:
        ;
        case 183:
          r[d] = readMemory(getIOValue(c, b));
          break;
        case 184:
        ;
        case 185:
        ;
        case 186:
        ;
        case 187:
        ;
        case 188:
        ;
        case 189:
        ;
        case 190:
        ;
        case 191:
          writeMemory(getIOValue(c, b), r[d]);
          break;
        case 192:
        ;
        case 193:
        ;
        case 194:
        ;
        case 195:
        ;
        case 196:
        ;
        case 197:
        ;
        case 198:
        ;
        case 199:
        ;
        case 200:
        ;
        case 201:
        ;
        case 202:
        ;
        case 203:
        ;
        case 204:
        ;
        case 205:
        ;
        case 206:
        ;
        case 207:
          e = getJumpConstant(c, b);
          PC = 2048 === (e & 2048) ? PC - (4096 - 2 * (e ^ 2048)) : PC + 2 * e;
          break;
        case 208:
        ;
        case 209:
        ;
        case 210:
        ;
        case 211:
        ;
        case 212:
        ;
        case 213:
        ;
        case 214:
        ;
        case 215:
        ;
        case 216:
        ;
        case 217:
        ;
        case 218:
        ;
        case 219:
        ;
        case 220:
        ;
        case 221:
        ;
        case 222:
        ;
        case 223:
          writeMemory(SP--, PC & 255);
          writeMemory(SP--, PC >> 8);
          e = getJumpConstant(c, b);
          PC = 2048 === (e & 2048) ? PC - (4096 - 2 * (e ^ 2048)) : PC + 2 * e;
          break;
        case 224:
        ;
        case 225:
        ;
        case 226:
        ;
        case 227:
        ;
        case 228:
        ;
        case 229:
        ;
        case 230:
        ;
        case 231:
        ;
        case 232:
        ;
        case 233:
        ;
        case 234:
        ;
        case 235:
        ;
        case 236:
        ;
        case 237:
        ;
        case 238:
        ;
        case 239:
          r[getSmallDestinationRegister(c, b)] = getBigConstant(c, b);
          break;
        case 240:
        ;
        case 241:
        ;
        case 242:
        ;
        case 243:
          e = !1;
          switch(b & 7) {
            case 0:
              e = C;
              break;
            case 1:
              e = Z;
              break;
            case 2:
              e = N;
              break;
            case 3:
              e = V;
              break;
            case 4:
              e = S;
              break;
            case 5:
              e = H;
              break;
            case 6:
              e = T;
          }
          e && (e = getBreakDistance(c, b), PC = 64 < e ? PC - 2 * (128 - e) : PC + 2 * e);
          break;
        case 244:
        ;
        case 245:
        ;
        case 246:
        ;
        case 247:
          e = !1;
          switch(b & 7) {
            case 0:
              e = !C;
              break;
            case 1:
              e = !Z;
              break;
            case 2:
              e = !N;
              break;
            case 3:
              e = !V;
              break;
            case 4:
              e = !S;
              break;
            case 5:
              e = !H;
              break;
            case 6:
              e = !T;
          }
          e && (e = getBreakDistance(c, b), PC = 64 < e ? PC - 2 * (128 - e) : PC + 2 * e);
          break;
        case 248:
        ;
        case 249:
          r[d] |= T << (b & 7);
          break;
        case 250:
        ;
        case 251:
          T = 0 < (r[d] & 1 << getRegisterValue(c, b));
          break;
        case 252:
        ;
        case 253:
          0 === (r[d] & 1 << (b & 7)) && (PC += 2);
          e = parseInt(memory[PC - 2], 16) & 15;
          f = parseInt(memory[PC - 1], 16);
          12 <= e && 148 == f | 149 == f && (PC += 2);
          16 <= e | 0 == e && 144 == f | 145 == f && (PC += 2);
          16 <= e | 0 == e && 146 == f | 147 == f && (PC += 2);
          break;
        case 254:
        ;
        case 255:
          0 < (r[d] & 1 << (b & 7)) && (PC += 2), e = parseInt(memory[PC - 2], 16), f = parseInt(memory[PC - 1], 16), 12 <= e && 148 == f | 149 == f && (PC += 2), 16 <= e | 0 == e && 144 == f | 145 == f && (PC += 2), 16 <= e | 0 == e && 146 == f | 147 == f && (PC += 2);
      }
    } else {
      forceBreak = !0, isNode() ? console.log("unknown 0x" + (PC - 2).toString(16).toUpperCase() + " " + c + " " + b) : alert("unknown 0x" + (PC - 2).toString(16).toUpperCase() + " " + c + " " + b);
    }
  }
  handleInput(pinB);
  handleInput(pinC);
  handleInput(pinD);
  handleInput(pinE);
  handleInput(pinF);
  r[d] &= 255;
  r[h] &= 255;
  memory[ADCSRA] &= 191;
  memory[ucsrb] |= 32;
  memory[spsr] |= 128;
}
function handleBreakpoint(c) {
  isNode() ? console.log("Breakpoint at 0x" + c) : alert("Breakpoint at 0x" + c);
}
function isSoftBreakpoint(c) {
  for (i = 0;i < softBreakpoints.length;i++) {
    if (softBreakpoints[i] + flashStart === c) {
      return!0;
    }
  }
  return!1;
}
function loop() {
  var c, b = !0;
  var start = new Date().getTime();
  for (j = 0;j < batchSize;j++) {
    timedInstructions++;
    var d = parseInt(memory[PC++], 16), h = parseInt(memory[PC++], 16), e = 149 == h && 152 == d || isSoftBreakpoint(PC) || forceBreak;
    if (207 == h && 255 == d || e) {
      b = !1, e ? (forceBreak = !1, isPaused = !0, handleBreakpoint((PC - 2).toString(16).toUpperCase())) : isNative() && Android.endProgram(), isNode() && console.log("Exit " + ((r[25] << 8) + r[24]));
    }
    fetch(h, d);
    for (i = 0;5 > i;i++) {
      switch(i) {
        case 0:
          c = dataQueueB;
          break;
        case 1:
          c = dataQueueC;
          break;
        case 2:
          c = dataQueueD;
          break;
        case 3:
          c = dataQueueE;
          break;
        case 4:
          c = dataQueueF;
      }
      for (;0 < c.length;) {
        writeSpecificPort(i);
      }
    }
    if (!b) {
      break;
    }
  }
  var end = new Date().getTime();
  var mhz = (batchSize/(end-start))/1000;
  reportMhz(mhz);
  flushPixelBuffer();
  b && setTimeout(loop, batchDelay);
}
function engineInit() {
  timedInstructions = 0;
  for (i = 0;i < r.length;i++) {
    r[i] = 0;
  }
  var c = 0;
  12 === parseInt(memory[flashStart], 16) && (c = flashStart + 2 * (parseInt(memory[flashStart + 3], 16) << 8 | parseInt(memory[flashStart + 2], 16)));
  c > usbVectorBase && (calculatedOffset = c - usbVectorBase);
  c = [];
  for (i = signatureOffset + calculatedOffset;i < signatureOffset + calculatedOffset + 32;i += 2) {
    c.push(String.fromCharCode(parseInt(memory[i], 16)));
  }
  switch(c.toString().replace(/,/g, "")) {
    case "Arduino Micro   ":
      hasDeviceSignature = !0;
  }
  initScreen();
}
function exec() {
  isPaused && (isPaused = !1, loop());
}
;
