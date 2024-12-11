import VirtualCanvas from "./virtualcanvas.js";
import TransactionManager from "./transactionmanager.js";
import ColorPicker from "./colorpicker.js";
import Brushsize from "./brushsize.js";
import Pencil from "./pencil.js";
import Input from "./input.js";
import socket from "./socket.js";
import Toolbar from "./toolbar.js";


const virtualCanvas = new VirtualCanvas();
const transactionManager = new TransactionManager();
const toolbar = new Toolbar(virtualCanvas, transactionManager);
const input = new Input(toolbar);
new socket(input, transactionManager, toolbar);
