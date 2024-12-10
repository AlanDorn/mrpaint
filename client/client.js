import VirtualCanvas from "./virtualcanvas.js";
import TransactionManager from "./transactionmanager.js";
import ColorPicker from "./colorpicker.js";
import Brushsize from "./brushsize.js";
import Pencil from "./pencil.js";
import Input from "./input.js";
import socket from "./socket.js";

const virtualCanvas = new VirtualCanvas();
const transactionManager = new TransactionManager(virtualCanvas);
const colorpicker = new ColorPicker();
const brushsize = new Brushsize();
const pencil = new Pencil(
  virtualCanvas,
  transactionManager,
  colorpicker,
  brushsize
);
const input = new Input(pencil);
new socket(input, transactionManager);
