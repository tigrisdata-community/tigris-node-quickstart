import { GetObjectCommand, S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import express from "express";

// Load environment variables from .env file
if(process.env.NODE_ENV !== 'production') {
  import('dotenv').then(({ default: dotenv }) => dotenv.config());
}

// Create an S3 client, which is used to connect to the Tigris bucket
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://fly.storage.tigris.dev`,
});

// Create an Express app
const app = express()
app.use(express.json({limit: '50mb'}));
app.use(express.static('public'))

// Define a route to list all files in the bucket
app.get("/api/files", async (req, res) => {
  // Create a command to list all objects in the bucket
  const command = new ListObjectsV2Command({
    Bucket: process.env.BUCKET_NAME
  });

  // Execute the command and retrieve all objects in the bucket
  let isTruncated = true;
  let contents = [];
  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken } = await S3.send(command);
    contents = contents.concat(Contents);
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
  }

  // Create a signed URL for each object in the bucket
  const files = []
  for (let content of contents) {
    const imageUrl = await getSignedUrl(S3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: content.Key
      }),
      { expiresIn: 3600 }
    )

    files.push({
      Key: content.Key,
      LastModified: content.LastModified,
      Url: imageUrl
    });
  }

  // Return the files array to the client
  res.json(files);
})

// Define a route to delete a file from the bucket
app.post("/api/delete_file", async (req, res) => {
  // Retrieve the name of the file to delete from the request body
  const { name } = req.body;

  // Create a command to delete the object from the bucket
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: name
  });

  // Execute the command to delete the object from the bucket
  await S3.send(command);
  res.json({ message: "ok" });
})

// Define a route to upload a file to the bucket
app.post("/api/upload_files", async (req, res) => {
  // Retrieve the data and name of the file to upload from the request body
  let { data, name } = req.body;

  // Decode the base64 data and create a buffer from it
  let base64Data = data.split(",")[1];
  const buf = Buffer.from(base64Data, 'base64')

  // Create an upload object to upload the file to the bucket
  const upload = new Upload({
    params: {
      Bucket: process.env.BUCKET_NAME,
      Key: name,
      Body: buf,
    },
    client: S3,
    queueSize: 3,
  });

  // Listen for progress events and log them to the console
  upload.on("httpUploadProgress", (progress) => {
    console.log(progress);
  });

  // Listen for error events and log them to the console
  upload.on("httpError", (error) => {
    console.error(error);
  });

  // Execute the upload and wait for it to complete
  await upload.done();

  // Create a signed URL for the uploaded object
  const imageUrl = await getSignedUrl(S3,
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: name
    }),
    { expiresIn: 3600 }
  )

  // Return the signed URL to the client
  res.json({ imageUrl })
});

// Start the Express app on the specified port
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server starting on port ${port}`);
});
