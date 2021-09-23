const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const _ = require("lodash");
const exec = require("child_process").exec;
const rand = require("random-id");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const mime = require("mime-types");
const jimp = require("jimp");
// mongodb client
const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://localhost:27017/";

const app = express();

// enable files upload
app.use(
    fileUpload({
        createParentPath: true,
    })
);

// add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(morgan("dev"));

const validator = require("validator");

// start app
const port = process.env.PORT || 3000;

const {
    readFile
} = require("fs");
const {
    SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS, RSA_NO_PADDING
} = require("constants");

app.listen(port, () => console.log(`[WinsVideo]: App is listening on port ${port}.`));

app.get("/", async (req, res) => {
    res.send({
        status: true,
        response: "WinsVideo API is online!"
    });
})

app.post("/upload", async (req, res) => {
    try {
        // check if any file has been uploaded
        if (!req.files) {
            res.send({
                status: false,
                error: "No video uploaded",
            });
        } else {
            // input
            const inputTitle = req.body.title;
            const inputDescription = req.body.description;
            const inputPrivacy = req.body.privacy;
            const inputTags = req.body.tags;
            const inputCategory = req.body.category;

            // video id
            const videoId = rand(12, "aA0");
            const id = rand(64, "aA0");

            // declare duration
            let videoDuration = 0;

            // check if category is valid
            if (inputCategory > 15) {
                res.status(500).send("Invalid category ID");
            } else if (inputCategory < 1) {
                res.status(500).send("Invalid category ID");
            } else {
                // do absolutely nothing
            }

            const video = req.files.video;
            let inFilename, outFilename, rawOutFileName;

            let thumbnailData;

            video.mv("./tmp/" + video.name);
            console.log("[WinsVideo]: Video has been uploaded and stored in the tmp folder")

            function videoUploadHandler() {
                setTimeout(function() {
                    // declare variables for ffmpeg
                    inFilename = "./tmp/" + video.name;
                    outFilename = "./uploads/videos/" + id + ".mp4";
                    rawOutFileName = id + ".mp4";
                    console.log("[WinsVideo]: Video Output Filename:" + outFilename);

                    // check if file is a video file
                    const ext = mime.extension(video.mimetype);
                    let validExts = ["mp4", "webm", "mov", "mkv"];
                    if (!validExts.includes(ext)) {
                        return res.status(403).send("Not a valid type, so sad. ")
                    };
                }, 500);
            }
                
            function convertToMp4() {
                setTimeout(function() {
                    ffmpeg(inFilename).outputOptions("-c:v", "copy").save(outFilename);

                    ffmpeg(inFilename).on("error", function(err) {
                        // handle error conditions
                        if (err) {
                            console.log("[WinsVideo]: ffmpeg: Error transcoding file");
                        } else {
                            console.log("[WinsVideo]: ffmpeg: Successfully transcoded the file");
                        }
                    });
                }, 1000);
            }

            function generateThumbnails() {
                const thumbnailId = rand(20, 'aA0')
                setTimeout(function() {
                    ffmpeg(outFilename)
                    .screenshot({
                      count: 3,
                      folder: './uploads/videos/thumbnails',
                      size: '1280x720',
                      filename: thumbnailId + '-' + videoId + '.png'
                    })
                    
                    thumbnailData = 
                        [
                            {
                                "0": {
                                    path: 'https://videos.winsvideo.net/uploads/videos/thumbnails/' + thumbnailId + '-' + videoId + '_1.png',
                                    selected: '1',
                                    videoUrl: videoId 
                                },
                                "1": {
                                    path: 'https://videos.winsvideo.net/uploads/videos/thumbnails/' + thumbnailId + '-' + videoId + '_2.png',
                                    selected: '0',
                                    videoUrl: videoId 
                                },
                                "2": {
                                    path: 'https://videos.winsvideo.net/uploads/videos/thumbnails/' + thumbnailId + '-' + videoId + '_3.png',
                                    selected: '0',
                                    videoUrl: videoId 
                                }
                            }   
                        ]
                    console.log("[WinsVideo]: Thumbnails for " + videoId + "has been generated");
                }, 2000);
            }

            function calculateVideoDuration() {
                setTimeout(function() {
                    ffmpeg.ffprobe(outFilename, function(err, metadata) {
                        const duration = metadata.streams[0].duration;
                        let hours = Math.floor(duration / 3600);
                        let mins = Math.floor((duration - hours * 3600) / 60);
                        let secs = Math.floor(duration % 60);
                        hours = hours < 1 ? "" : hours + ":";
                        mins = mins < 10 ? "0" + mins + ":" : mins + ":";
                        secs = secs < 10 ? "0" + secs : secs;
                        videoDuration = hours + mins + secs;
                        if(err) {
                            throw err;
                        } else {
                            console.log("[WinsVideo]: The video duration of " + rawOutFileName + " has been calculated. (" + videoDuration + ")");
                        }
                    });
                }, 3000); 
            }

            function deleteInputVideo() {
                setTimeout(function() {
                    fs.unlink(inFilename, (err) => {
                        if (err) {
                            throw err;
                        }
    
                        console.log(
                            "[WinsVideo]: Video: " + inFilename + " has been deleted from the tmp folder"
                        );
                    });
                }, 4000);
            }

            function insertVideoInfo() {
                setTimeout(function() {
                    // insert data into mongodb
                    let tagsArr = inputTags.split(',');
                    MongoClient.connect(url, function(err, db) {
                        if (err) throw err;
                        var dbo = db.db("winsvideo");
                        var data = {
                            video: {
                                title: inputTitle,
                                author: "nodejs",
                                description: inputDescription,
                                privacy: inputPrivacy,
                                tags: tagsArr,
                                category: inputCategory,
                                videoUrl: videoId,
                                path: "https://videos.winsvideo.net/uploads/videos/" +
                                    rawOutFileName,
                            },
                            thumbnail: {
                                thumbnailData
                            }
                        };

                        dbo.collection("videos").insertOne(data, function(err, res) {
                            if (err) {
                                throw err;
                            } else {
                                db.close();
                                console.log("[WinsVideo]: The video details has been inserted into the database");
                            }
                        });       
                    });

                    res.send({
                        status: true,
                        message: 'Your video has been uploaded!',
                        response: {
                            video: {
                                title: inputTitle,
                                author: "nodejs",
                                description: inputDescription,
                                privacy: inputPrivacy,
                                tags: tagsArr,
                                category: inputCategory,
                                url: 'https://winsvideo.net/watch?v=' + videoId + ''
                            },
                            thumbnail: thumbnailData,
                            file: {
                                name: video.name,
                                mimetype: video.mimetype,
                                size: video.size,
                                path: "https://videos.winsvideo.net/uploads/videos/" + rawOutFileName,
                            }
                        }
                    })
                }, 5000);
            }


            async function main() {
                await videoUploadHandler();
                await convertToMp4();
                await generateThumbnails();
                await calculateVideoDuration();
                await deleteInputVideo();
                await insertVideoInfo();
            }
            main();
        }
    } catch (err) {
        console.log(err);
    }
});