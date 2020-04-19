const Filter = require('../Filter')

/**
 * A pre-built filter to easily generate blank audio.
 *
 * @type {BlankAudioFilter}
 */
module.exports = class BlankAudioFilter extends Filter {
  /**
   * Creates a filter that, when used with lavfi, will generate an infinite blank audio source.
   *
   * @param {String} channelLayout - Defines the layout of the channels in the generated audio (default: 'stereo')
   * @param {Number} sampleRate - Defines the sample rate of the blank audio stream (default: 48000)
   */
  constructor({ channelLayout = 'stereo', sampleRate = 48000} = {}) {
    super('anullsrc', [
      `channel_layout=${channelLayout}`,
      `sample_rate=${sampleRate}`
    ]);
  }
}