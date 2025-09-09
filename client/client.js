//Combined version of old&new:
//healthy balance, more free than version1 but less hectic than version2


import TransactionLog  from "./transactionlog.js";
import VirtualCanvas   from "./virtualcanvas.js";
import ChangeTracker   from "./changetracker.js";
import Toolbar         from "./toolbar.js";
import MomentReplay    from "./momentreplay.js";
import MrPaintEngine   from "./mrpaintengine.js";
import Input           from "./input.js";
import Socket          from "./socket.js";
import TransferManager from "./transfermanager.js";
import LogManager      from "./logmanager.js";
import PresenceManager from "./presencemanager.js";
import PreviewManager from "./previewmanager.js"
// import "./testfunctions.js";

export function startup({wsUrl, canvasEl, dev = false} = {}) {

    const transactionLog = new TransactionLog();
    const virtualCanvas = new VirtualCanvas();

    const changeTracker = new ChangeTracker({
    virtualCanvas,
    });

    const toolbar = new Toolbar({
        transactionLog,
        virtualCanvas,
    });

    const momentReplay = new MomentReplay({
        transactionLog,
        virtualCanvas,
        changeTracker,
        toolbar,
    });
    
    const mrPaintEngine = new MrPaintEngine({
        transactionLog,
        virtualCanvas,        
        changeTracker,
        toolbar,
    });

    const input = new Input({
        virtualCanvas,
        toolbar,
    }); 

    const ws = new Socket({
        url: wsUrl,
    });

    const transferManager = new TransferManager({
        transactionLog,
        virtualCanvas,
        changeTracker,
        momentReplay,
        mrPaintEngine,
        ws,
    });

    const logManager = new LogManager({
        transactionLog,
        ws,
    });

    const presenceManager = new PresenceManager({
        virtualCanvas,
        input,
        ws,
    });

    const previewManager = new PreviewManager({
        virtualCanvas,
    });

    ws.onopen();

    if (dev) TestFunctions({ mrPaintEngine, transactionLog, ws });

    return{
        transactionLog,
        virtualCanvas,
        changeTracker,
        toolbar,
        momentReplay,
        mrPaintEngine,
        input,
        ws,
        transferManager,
        logManager,
        presenceManager,
        previewManager,
        destroy(){
            ws.onclose();
            input.destroy();
            //other listeners
        },        
    };
}

function TestFunctions() {
    import("./testfunctions.js").then();
}




//OLD1
//too loose, too free, hard to tell where I am & what is needed

// import TransactionLog  from "./transactionlog.js";
// import VirtualCanvas   from "./virtualcanvas.js";
// import ChangeTracker   from "./changetracker.js";
// import MomentReplay    from "./momentreplay.js";
// import MrPaintEngine   from "./mrpaintengine.js";
// import Input           from "./input.js";
// import Socket          from "./socket.js";
// import Toolbar         from "./toolbar.js";
// import LogManager      from "./logmanager.js";
// import TransferManager from "./transfermanager.js";
// import PresenceManager from "./presencemanager.js";
// import "./testfunctions.js";

// export const transactionLog  = new TransactionLog();
// export const virtualCanvas   = new VirtualCanvas();
// export const changeTracker   = new ChangeTracker();
// export const momentReplay    = new MomentReplay();
// export const toolbar         = new Toolbar();
// export const input           = new Input();
// export const mrPaintEngine   = new MrPaintEngine();

// export const ws              = new Socket();
// export const logManager      = new LogManager();
// export const transferManager = new TransferManager();
// export const presenceManager = new PresenceManager();


//OLD2 
//too tight, too coupled, hard to breathe

// import TransactionLog from "./transactionlog.js";
// import VirtualCanvas from "./virtualcanvas.js";
// import TransactionManager from "./transactionmanager.js";
// import Input from "./input.js";
// import socket from "./socket.js";
// import Toolbar from "./toolbar.js";

// import UserManager from "./usermanager.js";
// import PreviewManager from "./previewManager.js";

// There are some naming and conceptual things that need to be ironed out. The toolbar class seems to act not as just the toolbar but actually as the application front end for the input. Toolbar should be renamed to application/something to reflect that. Instead of passing in the transactionManager and the virtualcanvas into the socket you can just pass in the input since it should have both of those.

// In summary toolbar provides high level control code which is controlled by the input class/the user. So it could be renamed
// const transactionLog = new TransactionLog();
// const virtualCanvas = new VirtualCanvas();
// const transactionManager = new TransactionManager(transactionLog, virtualCanvas);
// const userManager = new UserManager();
// const previewManager = new PreviewManager(virtualCanvas);
// const toolbar = new Toolbar(transactionLog, virtualCanvas); // Toolbar(transactionManager)
// const input = new Input(toolbar); //Input(toolbar)
// socket(input, transactionManager, virtualCanvas, transactionLog);

// //so since transactionManager has transactionLog & virtualCanvas, can't toolbar then just have Transactionmanager sent in?
