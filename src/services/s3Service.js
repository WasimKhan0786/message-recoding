require('dotenv').config();
const fs = require('fs');
const { 
  S3Client, 
  HeadBucketCommand, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} = require('@aws-sdk/client-s3');

/**
 * Creates and configures the AWS SDK v3 S3 client for Filebase.
 */
function getS3Client() {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ? process.env.S3_ACCESS_KEY_ID.trim() : '';
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ? process.env.S3_SECRET_ACCESS_KEY.trim() : '';
  const endpoint = (process.env.S3_ENDPOINT || 'https://s3.filebase.io').trim();
  const region = (process.env.S3_REGION || 'auto').trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be defined in your .env file.');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true // Standard path-style addressing for S3-compatible endpoints
  });
}

/**
 * Tests connection to the Filebase S3 bucket using HeadBucketCommand.
 */
async function testFilebaseConnection() {
  const bucket = (process.env.S3_BUCKET || 'audioflow-storage').trim();
  const endpoint = (process.env.S3_ENDPOINT || 'https://s3.filebase.io').trim();
  const region = (process.env.S3_REGION || 'auto').trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ? process.env.S3_ACCESS_KEY_ID.trim() : '';
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ? process.env.S3_SECRET_ACCESS_KEY.trim() : '';

  if (!accessKeyId || !secretAccessKey) {
    return {
      success: false,
      bucket,
      endpoint,
      region,
      message: 'Missing credentials: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be provided in .env.'
    };
  }

  if (!bucket) {
    return {
      success: false,
      bucket: 'undefined',
      endpoint,
      region,
      message: 'S3_BUCKET is not set in .env. Expected "audioflow-storage".'
    };
  }

  let s3;
  try {
    s3 = getS3Client();
  } catch (initErr) {
    return {
      success: false,
      bucket,
      endpoint,
      region,
      message: initErr.message
    };
  }

  try {
    const command = new HeadBucketCommand({ Bucket: bucket });
    const response = await s3.send(command);

    return {
      success: true,
      bucket,
      endpoint,
      region,
      statusCode: response?.$metadata?.httpStatusCode || 200,
      message: `Filebase S3 connection verified. Bucket "${bucket}" is accessible with the configured credentials.`
    };
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    const errorCode = error?.name || error?.Code;

    let friendlyMessage = `Connection test failed: ${error.message || 'Unknown error'}`;

    if (statusCode === 403 || error.message?.includes('Access Denied') || error.message?.includes('Forbidden')) {
      friendlyMessage = 'Authentication failed (HTTP 403 Access Denied). Please ensure S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY match your active Filebase Access Key pair.';
    } else if (statusCode === 404 || errorCode === 'NotFound' || errorCode === 'NoSuchBucket') {
      friendlyMessage = `Bucket "${bucket}" was not found (HTTP 404). Please verify that the bucket exists in your Filebase console.`;
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      friendlyMessage = `DNS resolution failed for endpoint "${endpoint}". Please verify network connectivity.`;
    }

    return {
      success: false,
      bucket,
      endpoint,
      region,
      statusCode,
      errorCode,
      message: friendlyMessage
    };
  }
}

/**
 * Uploads a processed audio file from disk directly to Filebase S3.
 * 
 * @param {object} params
 * @param {string} params.filePath Local path to the file to upload
 * @param {string} params.key Destination S3 object key (e.g. "audio/123-filename.mp3")
 * @param {string} [params.contentType='audio/mpeg'] MIME type
 * @returns {Promise<{key: string, bucket: string, etag: string, cid?: string}>}
 */
async function uploadAudioFile({ filePath, key, contentType = 'audio/mpeg' }) {
  const bucket = (process.env.S3_BUCKET || 'audioflow-storage').trim();
  const s3 = getS3Client();

  const fileStream = fs.createReadStream(filePath);
  const fileStats = fs.statSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    ContentLength: fileStats.size
  });

  const response = await s3.send(command);

  // Filebase returns the IPFS CID in x-amz-meta-cid or headers
  const cid = response?.$metadata?.extendedRequestId || null;

  return {
    key,
    bucket,
    etag: response.ETag || '',
    cid,
    sizeBytes: fileStats.size
  };
}

/**
 * Streams an audio file from Filebase S3 supporting HTTP Range requests.
 * 
 * @param {object} params
 * @param {string} params.key S3 object key
 * @param {string} [params.range] HTTP Range header value (e.g. "bytes=0-1024")
 * @returns {Promise<{stream: ReadableStream, contentLength: number, contentType: string, contentRange?: string, statusCode: number}>}
 */
async function getAudioStream({ key, range }) {
  const bucket = (process.env.S3_BUCKET || 'audioflow-storage').trim();
  const s3 = getS3Client();

  const commandParams = {
    Bucket: bucket,
    Key: key
  };

  if (range) {
    commandParams.Range = range;
  }

  const command = new GetObjectCommand(commandParams);
  const response = await s3.send(command);

  return {
    stream: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType || 'audio/mpeg',
    contentRange: response.ContentRange,
    statusCode: response.$metadata?.httpStatusCode || 200,
    acceptRanges: response.AcceptRanges || 'bytes'
  };
}

/**
 * Deletes an audio object from Filebase S3.
 * 
 * @param {string} key S3 object key
 */
async function deleteAudioFromS3(key) {
  if (!key) return false;
  const bucket = (process.env.S3_BUCKET || 'audioflow-storage').trim();
  const s3 = getS3Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });
    await s3.send(command);
    return true;
  } catch (err) {
    console.error(`Failed to delete S3 object ${key}:`, err.message);
    return false;
  }
}

/**
 * Streams any stored file (such as images or media) from Filebase S3.
 * 
 * @param {object} params
 * @param {string} params.key S3 object key
 * @returns {Promise<{stream: ReadableStream, contentLength: number, contentType: string, statusCode: number}>}
 */
async function getFileStream({ key }) {
  const bucket = (process.env.S3_BUCKET || 'audioflow-storage').trim();
  const s3 = getS3Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  const response = await s3.send(command);

  return {
    stream: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType || 'application/octet-stream',
    statusCode: response.$metadata?.httpStatusCode || 200
  };
}

module.exports = {
  getS3Client,
  testFilebaseConnection,
  uploadAudioFile,
  uploadFile: uploadAudioFile,
  getAudioStream,
  getFileStream,
  deleteAudioFromS3,
  deleteFileFromS3: deleteAudioFromS3
};
