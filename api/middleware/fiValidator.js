const validator = require('express-validator');
const allowedCountries = ['834', '826'];

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
        .escape(),
    validator
        .body('dateOfBirth')
        .isISO8601()
        .withMessage('Invalid date of birth.')
        .custom((value) => {
            const today = new Date();
            const birthDate = new Date(value);

            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (
                monthDiff < 0 ||
                (monthDiff === 0 && today.getDate() < birthDate.getDate())
            ) {
                age--;
            }

            if (age < 18) {
                throw new Error('Client must be at least 18 years old.');
            }

            return true;
        }),
    validator
        .body('country')
        .trim()
        .isIn(allowedCountries)
        .withMessage(`Country must be one of: ${allowedCountries.join(', ')}`)
        .escape(),
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
        .isString()
        .notEmpty()
        .withMessage('VC must be specified.')
        .trim(),
    validator
        .body('userDid')
        .isString()
        .notEmpty()
        .withMessage('User DID must be specified.')
        .trim()
        .escape(),
    validator
        .body('proof')
        .notEmpty()
        .withMessage('Proof must be specified.'),
    validator
        .body('publicSignals')
        .isArray({ min: 5, max: 5 })
        .withMessage('Public signals must be an array of exactly 5 values.')
];