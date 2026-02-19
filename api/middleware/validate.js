const { validationResult } = require('express-validator');

exports.validate = (req, res, next) => {
    const errors = validationResult(req);

    console.log("errors####: ", errors)
    if (errors.isEmpty()) {
        return next();
    }

    console.log("kuna errors####: ")
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.param]: err.msg }));

    return res.status(422).json({
        errors: extractedErrors
    });
};