function doLoop(){
    console.log(loop);
    if (running==false) return;
    
    loop(); // execute one instruction
    if (singlestep) {
        switchRunningMode(false);
        singlestep = false;
    }
    
    if (running) window.setTimeout(doLoop,500);
};

var running = false;
var singlestep = false;


function singleStepButton(){
    singlestep = true;
    switchRunningMode(true);
    window.setTimeout(doLoop,500);
}

function runButton(){
    switchRunningMode(true)
    window.setTimeout(doLoop,500);
}

function pauseButton(){
        switchRunningMode(false);
}

function resetButton(){
    switchRunningMode(false);
    setupProc();
    readProgramFromUIWindow();
    updateUIwithProcState();
}

function switchRunningMode(mode){
    if (mode==true){
        $( "#ui-code-instructions").removeAttr('contenteditable').blur();
        $( "#ui-code-assembly").removeAttr('contenteditable').blur();
        $("#ui-run").addClass("green");
        $("#ui-run").addClass("loading");
        $("#ui-run").removeClass("red");
        running = true;
    }
    if (mode==false){
        $( "#ui-code-instructions").attr('contenteditable','true');;
        $( "#ui-code-assembly").attr('contenteditable','true');
        $("#ui-run").addClass("red");
        $("#ui-run").addClass("");
        $("#ui-run").removeClass("green");
        $("#ui-run").removeClass("loading");
        running = false;
    }
}

function setupProc(){
    target = "atmega328";
    
    timedInstructions=0; scalerTicks = 64; timerInterrupt = 92; TCNT0 = 70; TIFR0 = 53; ADCSRA = 122; ADCH = 121; ADCL = 120; SP = 95; SPH = 94; SPL = 93; r = Array(32); calculatedOffset = 0; SREG=0; C = 0; Z = 0; N = 0; V = 0; S = 0; H = 0; T = 0; I = 0; dataQueueB = []; dataQueueC = []; dataQueueD = []; dataQueueE = []; dataQueueF = []; pixelQueue = []; softBreakpoints = []; isPaused = !0; forceBreak = !1; hasDeviceSignature = !1; simulationManufacturerID = 191; uartBufferLength = 32; sdr=0; spsr=0; udr=0; ucsra=0; ucsrb=0; udri=0; memory;flashStart=0; dataStart=0; dataEnd=0; ioRegStart=0; portB=0; pinB = 57005; pinBTimer=0; portC=0; pinC = 57005; pinCTimer=0; portD=0; pinD = 57005; pinDTimer=0; portE=0; pinE = 57005; pinETimer=0; portF=0; pinF = 57005; pinFTimer=0; pllCsr=0; bitsPerPort=0; vectorBase=0; usbVectorBase=0; signatureOffset=0; jumpTableAddress=0; mainAddress=0; PC=0; optimizationEnabled=0; forceOptimizationEnabled = !1; disableUARTInterrupt = !1; batchSize = 1E4; inputCycles = 2E5; batchDelay = 0; adcValue = 42; disableHardware = !1; nativeFlag=0; spipinport1=0; spipinport2=0;

    initCore();
    engineInit();
    batchSize = 1;
    
};

function updateUIwithProcState(){
    
    // update PC
    $( "#ui-PC" ).text((PC-flashStart).toString(16));
    
    // update SP
    $( "#ui-SPH" ).text(SPH.toString(16));
    $( "#ui-SPL" ).text(SPH.toString(16));
    
    // update regs
    for(var i=0; i<32; i++){
        //console.log("ui-R"+i);
        $("#ui-R"+i).text(r[i].toString(16));
    }
};

function readProgramFromUIWindow(){
   var code= $( "#ui-code-instructions").text().trim().replace(/ /g,'');
   var i=0,j=0,len=(code.length/2);
   
   console.log("length is:"+len);
   console.log("code is:"+len);
   while(i<len){
       console.log((i)+" "+((i)+2));
     var b = code.substring(i,(i+2));
     
     console.log("Writing "+(j+flashStart)+": "+b)  ;
     writeMemory((j+flashStart), b);
     i=i+2;
     j=j+1;
   };
   
};


function updateCodeAddressLabels(){
   var lines =  $( "#ui-code-instructions").html().trim()
   .replace(/<br(\s*)\/*>/ig, '\n') // replace single line-breaks/**/
   .replace(/<[p|div]\s/ig, '\n$0') // add a line break before all div and p tags
   .replace(/(<([^>]+)>)/ig, "").split("\n");   // remove any remaining tags

      
   //update lines
    var len = lines.length
    var lineAddr=0;
    

    //console.log(lines);
       for (var i=0; i<len; i++){
       var line = lines[i];
       var nibbles = line.trim().replace(/ /g,'').length;
       if(nibbles%2 == 1) {
           $("#ui-code-addresses").addClass("invalid");
           return;
       } // one line is odd. someone is editing, skip this cycle
    }
    $("#ui-code-addresses").removeClass("invalid");
        // clear old lines
    $("#ui-code-addresses").html("");
    
    for (var i=0; i<len; i++){
       var line = lines[i];
       var nibbles = line.trim().replace(/ /g,'').length;
       //console.log(i+" "+nibbles);
       $("#ui-code-addresses").append("<div id='ui-code-line"+(i+flashStart)+"'>");
       if (nibbles !=0) $("#ui-code-addresses").append(pad((lineAddr/2).toString(16),4)+"</div>");
       if (nibbles == 0) $("#ui-code-addresses").append("</div>");
       lineAddr += nibbles;
    };

};

function markInstruction(){
    
}

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
