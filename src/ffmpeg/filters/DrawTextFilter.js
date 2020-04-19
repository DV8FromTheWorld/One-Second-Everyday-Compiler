const path = require('path')

const Filter = require('../Filter')

//Get the font path, but make sure it uses /'s, no matter the platform.
//ffmpeg doesn't seem to like windows paths in its filter arguments.
const FONT_PATH = `${__dirname}/../../../resources/mmrtextb.ttf`.split(path.sep).join('/')

/**
 * Pre-built filter to help draw readable text on the screen.
 *
 * @type {DrawTextFilter}
 */
module.exports = class DrawTextFilter extends Filter {
  /**
   * Creates a filter to draw text to the screen that has some options prebaked in.
   *
   * @param {String} text       - The text to write to the screen
   * @param {String | Number} x - The x-coordinate or math-function to determine the x-coordinate
   * @param {String | Number} y - The y-coordinate or the math-function to determine the y-coordinate
   * @param {Number} fontSize   - The size of the font to render the text
   */
  constructor({text = '', x = 0, y = 0, fontSize = 45} = {}) {
    super('drawtext', [
      `text='${text}'`,
      `fontfile=${FONT_PATH}`,
      `fontsize=${fontSize}`,
      `fontcolor=white`,
      `shadowx=2`,                 //text-shadow so that the white text is always visible, offset by 2
      `shadowy=2`,                 //text-shadow so that the white text is always visible, offset by 2
      `shadowcolor=DarkSlateGray`,
      `x=${x}`,
      `y=${y}`
    ])
  }
}