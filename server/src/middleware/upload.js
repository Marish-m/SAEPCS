import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads directory: <server>/uploads
const uploadsBaseDir = path.resolve(__dirname, '../../uploads');
const assignmentsDir = path.join(uploadsBaseDir, 'assignments');
const leavesDir = path.join(uploadsBaseDir, 'leaves');

// Ensure upload folders exist
[uploadsBaseDir, assignmentsDir, leavesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed file extensions & mimetypes
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.zip',
  '.txt',
  '.png',
  '.jpg',
  '.jpeg',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/pjpeg',
]);

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const createStorage = (subfolder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const targetDir = subfolder === 'assignments' ? assignmentsDir : leavesDir;
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const sanitizedBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${sanitizedBase}-${uniqueSuffix}${ext}`);
    },
  });
};

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
    const err = new Error(
      `Unsupported file type "${ext}". Allowed formats are PDF, DOC, DOCX, ZIP, TXT, PNG, JPG.`
    );
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }

  cb(null, true);
};

export const assignmentUpload = multer({
  storage: createStorage('assignments'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const leaveUpload = multer({
  storage: createStorage('leaves'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Reusable middleware wrapper to gracefully catch Multer errors (e.g. file too large or invalid type)
export const handleUpload = (uploader, fieldName = 'file') => {
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File size exceeds institutional limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed validation.',
        });
      }
      next();
    });
  };
};

export default {
  assignmentUpload,
  leaveUpload,
  handleUpload,
};
