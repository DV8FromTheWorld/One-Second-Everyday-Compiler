# One-Second-Everyday-Compiler
Contains scripts to put together 1 second everyday type videos with FFMPEG

# Install
**This program requires that `ffmpeg` and `ffprobe` be installed and globally available on the system.**
<br />You can find both of this for install [here](https://www.ffmpeg.org/download.html)

Pull the latest version from github
```
git clone https://github.com/DV8FromTheWorld/One-Second-Everyday-Compiler.git
cd One-Second-Everyday-Compiler
```

Install the package globally
```
npm install -g .
```

The `1se` executable will now be available globally throughout the system.

# Usage
Suppose you have all of your videos in a folder called `my-1se-videos`

The script expects one of the following folder structures:
<table>
  <thead>
    <tr>
      <th>
        1 Second Everday App
      </th>
      <th>
        Standard
      </th>
    </tr>
  </thead>
  
  <tbody>
    <tr>
      <td>This is the format that the 1 Second Everday app generates</td>
      <td>This is the format that the <a href="https://github.com/mistersender/1-sec-video-clipper" target="_blank">One Sec Video Clipper</a> generates.</td>
    </tr>
    <tr>
      <td>
        <pre>
my-1se-videos
  ├── 20190001
  │    └── clip.mp4
  ├── 20190002
  │    └── clip.mp4
  ├── 20190003
  │    └── clip.mp4
  └── 20190004
       └── clip.mp4
       </pre>
      </td>
      <td>
        <pre>
my-1se-videos
  ├── 2019-01-01
  │    └── clip.mp4
  ├── 2019-01-02
  │    └── clip.mp4
  ├── 2019-01-03
  │    └── clip.mp4
  └── 2019-01-04
       └── clip.mp4
       </pre>
      </td>
    </tr>
    <tr>
      <td>
        Date Format: <code>YYYYMMDD</code>
        <br /><span style="white-space: nowrap"><b>Note</b>: MM in this format is 0-based. Thus, January is <code>00</code></span>
      </td>
      <td>
        Date Format: <code>YYYY-MM-DD</code>
      </td>
    </tr>
  </tbody>
</table>

Simply navigate into the folder that contains the date-stamped folder structure and run the executable.
```
cd my-1se-videos
1se
```

After the process runs, your compiled video will be available in the folder as `1SE-video.mp4`


# Credits
This project was created jointly with [@mistersender](https://github.com/mistersender).
<br />It was originally inspired by [1 Second Everday](https://1se.co/)
