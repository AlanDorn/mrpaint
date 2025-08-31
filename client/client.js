import TransactionLog from "./transactionlog.js";
import VirtualCanvas from "./virtualcanvas.js";
import TransactionManager from "./transactionmanager.js";
import Input from "./input.js";
import socket from "./socket.js";
import Toolbar from "./toolbar.js"; //paintApp
import PreviewManager from "./previewmanager.js"



// MAYHEM: There are some naming and conceptual things that need to be ironed out. The toolbar class seems to act not as just the toolbar but actually as the application front end for the input. Toolbar should be renamed to application/something to reflect that. Instead of passing in the transactionManager and the virtualcanvas into the socket you can just pass in the input since it should have both of those.

// In summary toolbar provides high level control code which is controlled by the input class/the user. So it could be renamed
const transactionLog = new TransactionLog();
const virtualCanvas = new VirtualCanvas();
const previewManager = new PreviewManager(virtualCanvas);
const transactionManager = new TransactionManager(transactionLog, virtualCanvas);
const toolbar = new Toolbar(transactionLog, previewManager, virtualCanvas); // Toolbar(transactionManager)
const input = new Input(toolbar); //Input(toolbar)
socket(input, transactionManager, transactionLog, previewManager, virtualCanvas);

//so since transactionManager has transactionLog & virtualCanvas, can't toolbar then just have Transactionmanager sent in?
