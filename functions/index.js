/* eslint-disable */
const functions = require("firebase-functions");
//require('child_process_promise');
const mkdirp = require('mkdirp');
const admin = require('firebase-admin');
//const spawn = require('child-process-promise').spawn;
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

admin.initializeApp();
// Max height and width of the thumbnail in pixels.
const THUMB_MAX_HEIGHT = 200;
const THUMB_MAX_WIDTH = 200;

// Thumbnail prefix added to file names.
const THUMB_PREFIX = 'thumb_';

// Maximum time and memory taken by function
const runtimeOpts = {
    timeoutSeconds: 300,
    memory: '128MB'
}
/* eslint-disable */
exports.generateThumbnail = functions.runWith(runtimeOpts).https.onCall(async (object) =>{
// File and directory paths.
    const filePath = object.name;
    const contentType = object.contentType; // This is the image MIME type
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const thumbFilePath = path.normalize(path.join(fileDir, `${THUMB_PREFIX}${fileName}`));
    const tempLocalFile = path.join(os.tmpdir(), filePath);
    const tempLocalDir = path.dirname(tempLocalFile);
    const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath);
// Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith('image/')) {
        return console.log('This is not an image.');
    }
// Exit if the image is already a thumbnail.
    if (fileName.startsWith(THUMB_PREFIX)) {
        return console.log('Already a Thumbnail.');
    }

    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(filePath);
    const thumbFile = bucket.file(thumbFilePath);
    const metadata = {
        contentType: contentType,
    };
    // Create the temp directory where the storage file will be downloaded.
    await mkdirp(tempLocalDir)
// Download file from bucket.
    await file.download({destination: tempLocalFile});
    console.log('The file has been downloaded to', tempLocalFile);
// Generate a thumbnail using ImageMagick.
     await spawn('convert',
        [tempLocalFile, '-thumbnail', `${THUMB_MAX_WIDTH}x${THUMB_MAX_HEIGHT}>`,
            tempLocalThumbFile],
        {capture: ['stdout', 'stderr']}
    );
    console.log('Thumbnail created at', tempLocalThumbFile);
// Uploading the Thumbnail.
    await bucket.upload(
        tempLocalThumbFile,
        {destination: thumbFilePath, metadata: metadata}
    );
    console.log('Thumbnail uploaded to Storage at', thumbFilePath);
// Once the image has been uploaded delete the local files to free //up disk space.
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempLocalThumbFile);
// Get the Signed URLs for the thumbnail and original image.
    const config = {
        action: 'read',
        expires: '03-01-2500',
    };
    const results = await Promise.all([
        thumbFile.getSignedUrl(config),
        file.getSignedUrl(config),
    ]);
    console.log('Got Signed URLs.');
    const thumbResult = results[0];
    const originalResult = results[1];
    const thumbFileUrl = thumbResult[0];
    const fileUrl = originalResult[0];
// Return the URLs to the Database
    return {thumb:thumbFileUrl};
});
// "type": "module",

// "lint": "eslint .",    above serve
// exports.randomNumber = functions.https.onRequest((request,response) =>{
//     const number = 480;
//     response.send(number.toString());
// });
// });
