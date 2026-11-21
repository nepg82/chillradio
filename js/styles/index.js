// Style registry. To add a style: create js/styles/<name>.js, import it here,
// add it to the array, and add the file to ASSETS in sw.js.
import chillwave from './chillwave.js';
import synthwave from './synthwave.js';
import darksynth from './darksynth.js';
import lofi from './lofi.js';
import electro from './electro.js';

export const STYLES = [chillwave, synthwave, darksynth, lofi, electro];
