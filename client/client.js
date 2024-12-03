import VirtualCanvas from "./virtualcanvas.js";
import ColorPicker from "./colorpicker.js";
import Brushsize from "./brushsize.js";
import Pencil from "./pencil.js";
import Input from "./input.js";
import Socket from "./socket.js";

const virtualCanvas = new VirtualCanvas();
const colorpicker = new ColorPicker();
const brushsize = new Brushsize();
const pencil = new Pencil(virtualCanvas, colorpicker, brushsize);
const input = new Input(pencil);
new Socket(input, virtualCanvas);
