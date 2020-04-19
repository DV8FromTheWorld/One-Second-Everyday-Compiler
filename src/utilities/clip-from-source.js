const {spawn, exec} = require('child_process')

//TODO
// Check if clip and source are the same size
//  If source is higher res than clip, get screenshots at source resolution
//  If we fail to find timestamps, downscale source to clip resolution (copy), get screenshots again, find timestamps
//  Always retrieve newClip from un-downscaled source clip
//
// What to do when multiple blackframes are detected
//  When we downscale to match screenshots from lower-res clip, likeliness that we have multiple blackframe detections increases.
//  Possibilities:
//    - Naively pick the first one?
//    - Compare distances between frames, take average?
//    - Re-run with higher requirements?
//
// Detect whether the audio is silent?
//  I don't really think this is an issue, but figured I'd mention it.

;(async () => {
  const time = Date.now()

  const source = "source.mp4"
  const clip = "clip.mp4"
  const newClip = "newClip.mp4"
  
  const startFrame = "start.jpg"
  const endFrame = "end.jpg"
  
  //Remove start/end frames from previous executions
  console.log("Removing previous files...")
  await runCommand(`rm -f ${startFrame}`)
  await runCommand(`rm -f ${endFrame}`)
  await runCommand(`rm -f ${newClip}`)
  
  
  //Get total amount of frames in the clip. Used to find last frame
  //Source: https://stackoverflow.com/questions/2017843/fetch-frame-count-with-ffmpeg
  console.log("Determining final frame of clip...")
  const { stdout } = await runCommand(`ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nokey=1:noprint_wrappers=1 ${clip}`)
  const frameCount = stdout.replace('\r', '').replace('\n', '')
  const finalFrame = frameCount - 1
  
  //Get frames
  console.log("Extracting start and ending frame...")
  await runCommand(`ffmpeg.exe -loglevel panic -i ${clip} -vframes 1 -f image2 "${startFrame}"`)
  await runCommand(`ffmpeg.exe -i ${clip} -vf select=\'eq\(n,${finalFrame}\) -vframes 1 ${endFrame}`)
  
  console.log("Getting timestamp of starting frame...")
  const startTime = await getDurationTimestampOfFrame(source, startFrame)
  
  console.log("Getting timestamp of ending frame...")
  const endTime = await getDurationTimestampOfFrame(source, endFrame)
  
  console.log("Cutting source to newClip...")
  await runCommand(`ffmpeg.exe -i ${source} -ss ${startTime} -to ${endTime}  -s 1920x1080 ${newClip}`)
  
  console.log(`Done! Total Time: ${(Date.now() - time) / 1000}s`)
})();

async function getDurationTimestampOfFrame(source, frameFileName) {
  //Example:
  // [Parsed_blackframe_1 @ 0000017b43c34540] frame:460 pblack:100 pts:1393471 t:15.483011 type:B last_keyframe:320
  //Retrieves:
  // Group 1: "1"        //(incrementer)
  // Group 2: "460"      //frame number 
  // Group 3: "15.48301  //duration of frame
  const blackFrameRegex = new RegExp("Parsed_blackframe_([0-9]+) @ .*? frame:([0-9]+) .*? t:(.+?) .*")
  
  //Source: https://stackoverflow.com/questions/52825892/find-frame-in-video-using-ffmpeg
  const { stderr } = await runCommand(`ffmpeg.exe  -i ${source} -r 1 -loop 1 -i ${frameFileName} -an -filter_complex "blend=difference:shortest=1,blackframe=99:32" -f null -`)
  //console.log(stderr)
  const lines = stderr
    .split('\n')
    .filter(line => {
      return blackFrameRegex.test(line.toString())
    })
    
  if (lines.length < 1) {
    throw new Error(`Problem determining duration for frame: ${frameFileName}. Found: ${lines.length}`)
  }
  
  const [_, __, frameNumber, duration] = blackFrameRegex.exec(lines[0])
  
  return duration
}

async function trimClipByTimestamps(source, start, end) {
  
}

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      }

      resolve({
        stdout: stdout,
        stderr: stderr
      })
    })
  })
}