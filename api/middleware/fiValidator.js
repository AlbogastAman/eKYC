const validator = require('express-validator');

exports.registration = [

    validator
        .body('login')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Login must be specified.')
        .matches(/^[\w\d ]+$/)
        .withMessage('Login has non-alphanumeric characters.')
        .escape(),
    validator
        .body('password')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Password must be specified.')
        .escape(),
    validator
        .body('name')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Name must be specified.')
        .matches(/^[\w\d ]+$/)
        .withMessage('Name has non-alphanumeric characters.')
        .escape(),
    validator
        .body('idNumber')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Id number must be specified.')
        .isAlphanumeric()
        .withMessage('Name has non-alphanumeric characters.')
        .escape()
];

exports.login = [

    validator
        .body('login')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Login must be specified.')
        .matches(/^[\w\d ]+$/)
        .withMessage('Login has non-alphanumeric characters.')
        .escape(),
    validator
        .body('password')
        .isLength({ min: 1 })
        .trim()
        .withMessage('Password must be specified.')
        .escape()
];


exports.vc = [
    validator
        .body('vc')
        .isLength({ min: 1 })
        .trim()
        .withMessage('VC must be specified.')
        .escape(),
    validator
        .body('userDid')
        .isLength({ min: 1 })
        .trim()
        .withMessage('User DID must be specified.')
        .escape(),
    validator
        .body('proofs')
        .notEmpty()
        .withMessage('Proofs must be specified.'),
    validator
        .body('publicSignals')
        .isArray({ min: 5, max: 5 })
        .withMessage('Public signals must be an array of exactly 5 values.')
];