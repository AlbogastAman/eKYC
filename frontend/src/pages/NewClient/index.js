import React, { useState, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Flex, Box, Card, Heading, Text, Form, Field, Button, Loader } from 'rimble-ui';
import { QRCodeCanvas } from 'qrcode.react';
import qs from 'qs';
import api from '../../service/api';

const Login = () => {

    const history = useHistory();

    const [validated, setValidated] = useState(false);
    const [clientData, setClientData] = useState({});
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitDisabled, setSubmitDisabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [newClientMsg, setNewClientMsg] = useState('');
    const [showQR, setShowQR] = useState(true);
    const [qrData, setQrData] = useState(null);

    function handleName(e) {
        setClientData({ ...clientData, name: e.target.value });
    };

    function handleAddress(e) {
        setClientData({ ...clientData, address: e.target.value });
    };

    function handleDateOfBirth(e) {
        setClientData({ ...clientData, dateOfBirth: e.target.value });
    };

    function handleIdNumber(e) {
        setClientData({ ...clientData, idNumber: e.target.value });
    };

    function handleCounrty(e) {
        setClientData({ ...clientData, country: e.target.value });
    };


    function handleLogin(e) {
        setClientData({ ...clientData, login: e.target.value });
    };

    function handlePassword(e) {
        setClientData({ ...clientData, password: e.target.value });
    };

    function handleConfirmPassword(e) {
        setConfirmPassword(e.target.value);
    };

    const validateForm = useCallback(
        () => {
            if (
                clientData.name && clientData.name.length > 0 &&
                clientData.address && clientData.address.length > 0 &&
                clientData.dateOfBirth && clientData.dateOfBirth.length > 0 &&
                clientData.idNumber && clientData.idNumber.length > 0 &&
                clientData.country && clientData.country.length > 0 &&
                clientData.login && clientData.login.length > 0 &&
                clientData.password && clientData.password.length > 5 &&
                clientData.password === confirmPassword &&
                !isLoading
            ) {
                setValidated(true);
                setSubmitDisabled(false);
            } else {
                setValidated(false);
                setSubmitDisabled(true);
            }
        },
        [clientData, confirmPassword, isLoading]
    );

    useEffect(() => {
        setQrData({
            "message": "Verifiable Credential issued. Please save your salts securely.",
            "txId": "did:fabric:ekyc:JAN1",
            "did": "did:fabric:ekyc:JAN1",
            "vc": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImRpZDpmYWJyaWM6b3JnMSNrZXktMSJ9.eyJpYXQiOjE3NzE2Mjc3MzAsInN1YiI6ImRpZDpmYWJyaWM6ZWt5YzpKQU4xIiwiaXNzIjoiZGlkOmZhYnJpYzpvcmcxIiwidmMiOnsiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q3JlZGVudGlhbCJdLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpmYWJyaWM6ZWt5YzpKQU4xIiwibmFtZSI6IkpBTkUgRE9FIiwiYWRkcmVzcyI6IkJPWCAxMjM0IiwiemtQcm9vZnMiOnsiZGF0ZU9mQmlydGhIYXNoIjoiMjE3MTY0NjA5NzIzNjEyNDIxMjAwNzQyODk3NTkwNDMzNzM4MjMxODE4NDQ3OTQzNjk1ODMxNjgxNzM5MTczOTUwODgyOTk2MjU4MDUiLCJpZE51bWJlckhhc2giOiIxNjYxNzA1NjIwODI5NzU3NjUyNzEwMDYwNDg5MTM0NDU1NjcyNjI4OTg4NjQ3MDk0MDUwMDU0NjE4MTc4MTgzMzMzOTQ2MjYzNTE1MyIsImNvdW50cnlIYXNoIjoiMjA4MjI5NDMyMjA4NzUyMDQ3MjE3NzIzODU2MDQyMzIxOTg5NTU0NjcyMjIwMDI3MDE5OTg1MzM5Mzc5OTM2NjkwMDY5Nzk3MjMzNjYifX19fQ.TgqryQyBwZUAowqPvAT7Ek57ejkq7ySdQFQL1xotPhTGKWMzPXqEotSi95qvxJlinxG3ndJB3GuoNVENRYuSQw",
            "salts": {
                "idNumber": "d8544d0f8c7d8d4779bd297ca9ea62c0",
                "dateOfBirth": "d96ca53e7e480b1248c87ea91056c853",
                "country": "5f665680ddb5e57ab75d66c2c9152c4c"
            },
            "rawClaims": {
                "name": "JANE DOE",
                "dateOfBirth": "2000-06-20",
                "address": "BOX 1234",
                "country": "834",
                "idNumber": "JA1234"
            }
        })
    }, [])

    useEffect(() => {
        validateForm();
    }, [validateForm]);

    useEffect(() => {
        if (validated && isLoading) {
            try {
                api
                    .post('/fi/createClient', qs.stringify(clientData))
                    .then(res => {
                        console.log(res);
                        if (res.status === 200) {
                            setNewClientMsg(res.data.message);

                            // 👇 Data you want inside QR
                            const payload = {
                                message: res.data.message,
                                login: clientData.login,
                                did: res.data.ledgerId || null
                            };

                            setQrData(payload);
                            setShowQR(true);
                        } else {
                            console.log('Oopps... something wrong, status code ' + res.status);
                            return function cleanup() { }
                        }
                    })
                    .catch((err) => {
                        console.log('Oopps... something wrong');
                        console.log(err);
                        return function cleanup() { }
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            } catch (error) {
                console.log('Oopps... something wrong');
                console.log(error);
                setIsLoading(false);
                return function cleanup() { }
            }
        }
    }, [clientData, validated, isLoading, history]);

    const handleSubmit = e => {
        e.preventDefault();
        setIsLoading(true);
        setNewClientMsg('');
    };

    const handleClickOnBack = e => {
        e.preventDefault();
        history.push('/fi');
    }

    return (
        <Flex height={'100vh'}>
            <Box mx={'auto'} my={'auto'} width={[1, 9 / 12, 7 / 12]}>
                <Flex px={2} mx={'auto'} justifyContent='space-between'>
                    <Box my={'auto'}>
                        <Heading as={'h2'} color={'primary'}>New Client</Heading>
                    </Box>
                    <Box my={'auto'}>
                        <Button onClick={handleClickOnBack}>Back</Button>
                    </Box>
                </Flex>
                <Form onSubmit={handleSubmit}>
                    <Card mb={20}>
                        <Flex mx={-3} flexWrap={"wrap"}>
                            <Box width={1} px={3}>
                                <Field label="Name" width={1}>
                                    <Form.Input
                                        type="text"
                                        required
                                        onChange={handleName}
                                        value={clientData.name}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="Address" width={1}>
                                    <Form.Input
                                        type="text"
                                        required
                                        onChange={handleAddress}
                                        value={clientData.address}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="Date of Birth" width={1}>
                                    <Form.Input
                                        type="date"
                                        required
                                        onChange={handleDateOfBirth}
                                        value={clientData.dateOfBirth}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="ID Number" width={1}>
                                    <Form.Input
                                        type="text"
                                        required
                                        onChange={handleIdNumber}
                                        value={clientData.idNumber}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="Country" width={1}>
                                    <Form.Input
                                        type="text"
                                        required
                                        onChange={handleCounrty}
                                        value={clientData.country}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                        </Flex>
                    </Card>
                    <Card>
                        <Flex mx={-3} flexWrap={"wrap"}>
                            <Box width={1} px={3}>
                                <Field label="Login" width={1}>
                                    <Form.Input
                                        type="text"
                                        required
                                        onChange={handleLogin}
                                        value={clientData.login}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="Password" width={1}>
                                    <Form.Input
                                        type="password"
                                        required
                                        onChange={handlePassword}
                                        value={clientData.password}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                            <Box width={1} px={3}>
                                <Field label="Confirm password" width={1}>
                                    <Form.Input
                                        type="password"
                                        required
                                        onChange={handleConfirmPassword}
                                        value={confirmPassword}
                                        width={1}
                                    />
                                </Field>
                            </Box>
                        </Flex>
                        <Flex mx={-3} alignItems={'center'}>
                            <Box px={3}>
                                <Button type="submit" mt={2} disabled={submitDisabled}>
                                    {isLoading ? <Loader color="white" /> : <p>Register new client</p>}
                                </Button>
                            </Box>
                            {newClientMsg &&
                                <Box px={3}>
                                    <Text>{newClientMsg}</Text>
                                </Box>
                            }
                            {showQR && (
                                <Box
                                    style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        zIndex: 9999
                                    }}
                                >
                                    <Card p={4} width={[1, 1 / 2]} textAlign="center">
                                        <Heading as="h3" mb={3}>Client Created Successfully</Heading>

                                        {qrData && (
                                            <QRCodeCanvas
                                                value={JSON.stringify(qrData)}
                                                size={220}
                                            />
                                        )}

                                        <Text mt={3}>
                                            Scan this QR to retrieve client information
                                        </Text>

                                        <Button mt={3} onClick={() => setShowQR(false)}>
                                            Close
                                        </Button>
                                    </Card>
                                </Box>
                            )}
                        </Flex>
                    </Card>
                </Form>
            </Box>
        </Flex>
    );
}

export default Login;