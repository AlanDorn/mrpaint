import TransactionLog from "./transactionlog.js";
import VirtualCanvas from "./virtualcanvas.js";
import TransactionManager from "./transactionmanager.js";
import Input from "./input.js";
import socket from "./socket.js";
import Toolbar from "./toolbar.js";

// import UserManager from "./usermanager.js";
// import PreviewManager from "./previewManager.js";

// MAYHEM: There are some naming and conceptual things that need to be ironed out. The toolbar class seems to act not as just the toolbar but actually as the application front end for the input. Toolbar should be renamed to application/something to reflect that. Instead of passing in the transactionManager and the virtualcanvas into the socket you can just pass in the input since it should have both of those.

// In summary toolbar provides high level control code which is controlled by the input class/the user. So it could be renamed
const transactionLog = new TransactionLog();
const virtualCanvas = new VirtualCanvas();
const transactionManager = new TransactionManager(transactionLog, virtualCanvas);
// const userManager = new UserManager();
// const previewManager = new PreviewManager(virtualCanvas);
const toolbar = new Toolbar(transactionLog, virtualCanvas); // Toolbar(transactionManager)
const input = new Input(toolbar, transactionManager); //Input(toolbar)
socket(input, transactionManager, virtualCanvas, transactionLog);

//so since transactionManager has transactionLog & virtualCanvas, can't toolbar then just have Transactionmanager sent in?
