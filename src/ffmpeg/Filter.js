/**
 * Represents a FFMPEG filter and handles the process for formulating CLI strings for them.
 *
 * @type {Filter}
 */
module.exports = class Filter {
  /**
   * @example
   * const colorFilter = new Filter('color', [
   *   `c=green`,
   *   `duration=5`,
   *   `s=1920x1080`
   * ])
   *
   * colorFilter.compile()
   * // color=c=green:duration=5:s=1920x1080
   *
   * @param {String} filterName - The name of the filter as defined by the FFMPEG docs
   * @param {Array<String>} filterArgs - The arguments for this filter
   */
  constructor(filterName, filterArgs) {
    this.filterName = filterName
    this.filterArgs = filterArgs
  }

  /**
   * Compiles the filter into the CLI useable string.
   * The filter will still need to be wrapped in quotes when used.
   *
   * @returns {string}
   */
  compile() {
    return `${this.filterName}=${this.filterArgs.join(':')}`
  }
}