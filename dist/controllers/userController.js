"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userSchema_1 = require("../schema/db/userSchema");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../utils/config"));
const userSchema_2 = require("../schema/zod/userSchema");
const helper_1 = require("../utils/helper");
const userController = {
    signup(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            const alreadyExists = yield userSchema_1.UserModel.findOne({ username });
            if (alreadyExists) {
                res.status(400).json({
                    message: 'Username already in use',
                });
                return;
            }
            const check = userSchema_2.userSignupSchema.safeParse({ username, password });
            if (!check.success) {
                res.status(404).json({
                    message: 'make sure username is unique and password is minimum 5 characters long',
                });
                return;
            }
            try {
                const hashedPassword = yield helper_1.Password.hash(password);
                const user = yield userSchema_1.UserModel.create({
                    username,
                    password: hashedPassword,
                });
                res.status(200).json({
                    message: 'User signed up successfully',
                });
            }
            catch (error) {
                res.status(400).json({
                    message: 'Internal server error',
                });
            }
        });
    },
    signin(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            const check = userSchema_2.userSignInSchema.safeParse({ username, password });
            if (!check.success) {
                res.status(400).json({ message: 'Invalid username or password format' });
                return;
            }
            try {
                const user = yield userSchema_1.UserModel.findOne({ username });
                if (!user) {
                    res.status(401).json({
                        message: 'Username is invalid',
                    });
                    return;
                }
                const isMatch = yield helper_1.Password.compare(password, user.password);
                if (!isMatch) {
                    res.status(401).json({ message: 'Password is wrong' });
                    return;
                }
                const token = jsonwebtoken_1.default.sign({ id: user._id }, config_1.default.JWT_SECRET);
                res.status(200).json({ token, message: 'Successfull' });
            }
            catch (error) {
                console.error('Error during signin:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
    },
    resetPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { password, newPassword } = req.body;
            const { userId: _id } = req;
            try {
                //check if user exists
                const user = yield userSchema_1.UserModel.findOne({ _id });
                if (!user) {
                    res.status(401).json({
                        message: 'Username is invalid',
                    });
                    return;
                }
                //compare the password
                const isMatch = yield helper_1.Password.compare(password, user.password);
                if (!isMatch) {
                    res.status(401).json({ message: 'Password is wrong' });
                    return;
                }
                const samePassword = yield helper_1.Password.compare(newPassword, user.password);
                if (samePassword) {
                    res.status(400).json({ message: 'New password cannot be the same as the old password' });
                    return;
                }
                //password zod validation
                const check = userSchema_2.resetPasswordSchema.safeParse({ password: newPassword });
                if (!check.success) {
                    res.status(400).json({ message: 'Invalid password format' });
                    return;
                }
                //hash password
                const hashedPassword = yield helper_1.Password.hash(newPassword);
                //upadte password in db
                const updatedUser = yield userSchema_1.UserModel.findByIdAndUpdate({ _id }, { password: hashedPassword });
                if (!updatedUser) {
                    res
                        .status(400)
                        .json({ message: 'Could not reset the password try again!' });
                    return;
                }
                res.status(202).json({
                    message: 'password changed successfully',
                });
            }
            catch (error) {
                console.error('Error during signin:', error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
    },
    username(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username } = req.body;
            const user = yield userSchema_1.UserModel.findOne({ username });
            if (user) {
                res.status(200).json({
                    value: false,
                    message: 'Username already in use',
                });
                return;
            }
            res.status(200).json({
                value: true,
                message: 'Username is available',
            });
        });
    },
};
exports.default = userController;
