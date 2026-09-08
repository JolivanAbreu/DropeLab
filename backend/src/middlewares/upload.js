const multer = require('multer');
const ApiError = require('../utils/apiError');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Sempre em memória, nunca em disco diretamente aqui — quem decide o
// destino final (bucket S3/R2 ou disco local) é integrations/storage.js,
// a partir do buffer em req.file.buffer. Isso permite trocar de disco local
// pra armazenamento de objetos sem mexer em nenhuma rota/controller que usa
// esse middleware.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.', 'invalid_image_type'));
    }
    cb(null, true);
  },
});

module.exports = { upload };
