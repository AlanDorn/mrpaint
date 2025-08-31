import TransactionLog  from "./transactionlog.js";
import VirtualCanvas   from "./virtualcanvas.js";
import ChangeTracker   from "./changetracker.js";
import MomentReplay    from "./momentreplay.js";
import MrPaintEngine   from "./mrpaintengine.js";
import Input           from "./input.js";
import Socket          from "./socket.js";
import Toolbar         from "./toolbar.js";
import LogManager      from "./logmanager.js";
import TransferManager from "./transfermanager.js";
import PresenceManager from "./presencemanager.js";
import "./testfunctions.js";

export const transactionLog  = new TransactionLog();
export const virtualCanvas   = new VirtualCanvas();
export const changeTracker   = new ChangeTracker();
export const momentReplay    = new MomentReplay();
export const toolbar         = new Toolbar();
export const input           = new Input();
export const mrPaintEngine   = new MrPaintEngine();

export const ws              = new Socket();
export const logManager      = new LogManager();
export const transferManager = new TransferManager();
export const presenceManager = new PresenceManager();