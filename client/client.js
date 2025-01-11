import VirtualCanvas from "./virtualcanvas.js";
import TransactionManager from "./transactionmanager.js";
import Input from "./input.js";
import socket from "./socket.js";
import Toolbar from "./toolbar.js";


const virtualCanvas = new VirtualCanvas();
const transactionManager = new TransactionManager(virtualCanvas);
const toolbar = new Toolbar(virtualCanvas, transactionManager);
const input = new Input(toolbar, virtualCanvas);
new socket(input, transactionManager, toolbar);