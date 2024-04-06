import { GetObjectCommand, S3Client, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import express from "express";

if(process.env.NODE_ENV !== 'production') {
  import('dotenv').then(({ default: dotenv }) => dotenv.config());
}

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://fly.storage.tigris.dev`,
});

const app = express()
app.use(express.json({limit: '50mb'}));
app.use(express.static('public'))

app.get("/api/files", async (req, res) => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.BUCKET_NAME
  });

  let isTruncated = true;

  let contents = [];
  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken } = await S3.send(command);
    contents = contents.concat(Contents);
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
  }

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

  res.json(files);
})

app.post("/api/delete_file", async (req, res) => {
  const { name } = req.body;
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: name
  });

  await S3.send(command);
  res.json({ message: "ok" });
})

app.post("/api/upload_files", async (req, res) => {
  let { data, name } = req.body;
  let base64Data = data.split(",")[1];
  const buf = Buffer.from(base64Data, 'base64')
  const upload = new Upload({
    params: {
      Bucket: process.env.BUCKET_NAME,
      Key: name,
      Body: buf,
    },
    client: S3,
    queueSize: 3,
  });

  upload.on("httpUploadProgress", (progress) => {
    console.log(progress);
  });

  upload.on("httpError", (error) => {
    console.error(error);
  });

  await upload.done();

  const imageUrl = await getSignedUrl(S3,
    new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: name
    }),
    { expiresIn: 3600 }
  )

  res.json({ imageUrl })
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server starting on port ${port}`);
});
