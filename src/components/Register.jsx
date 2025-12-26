import React, { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  Link,
  useToast,
  InputGroup,
  InputLeftElement,
  FormErrorMessage,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Divider,
  Icon
} from '@chakra-ui/react';
import { PhoneIcon, EmailIcon, LockIcon } from '@chakra-ui/icons';
import { FaUser, FaHome } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { addUser, getUsers } from '../utils/storage';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    room: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = '請輸入姓名';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = '請輸入電話號碼';
    } else if (!/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = '請輸入有效的10位電話號碼';
    }
    if (!formData.room.trim()) {
      newErrors.room = '請輸入房間號';
    }
    if (!formData.password) {
      newErrors.password = '請輸入密碼';
    } else if (formData.password.length < 6) {
      newErrors.password = '密碼至少6位';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '兩次密碼輸入不一致';
    }
    const users = getUsers();
    if (users.find(u => u.phone === formData.phone)) {
      newErrors.phone = '此電話號碼已被註冊';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const newUser = addUser({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        room: formData.room.trim(),
        password: formData.password,
        username: formData.phone.trim()
      });
      toast({
        title: '註冊成功',
        description: '歡迎加入廣大城租客管理系統',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      toast({
        title: '註冊失敗',
        description: '系統錯誤，請稍後再試',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" py={12} px={4}>
      <Container maxW="md">
        <VStack spacing={8}>
          <VStack spacing={2}>
            <Heading size="2xl" color="blue.600" textAlign="center">
              廣大城租客管理
            </Heading>
            <Text color="gray.600" fontSize="lg">
              註冊新帳戶
            </Text>
          </VStack>

          <Card w="100%" shadow="xl" borderRadius="xl">
            <CardHeader>
              <Heading size="md" color="blue.600" textAlign="center">
                用戶註冊
              </Heading>
            </CardHeader>
            <Divider />
            <CardBody>
              <form onSubmit={handleSubmit}>
                <VStack spacing={5}>
                  <FormControl isInvalid={errors.name} isRequired>
                    <FormLabel>姓名</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={FaUser} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        name="name"
                        placeholder="請輸入您的姓名"
                        value={formData.name}
                        onChange={handleChange}
                        size="lg"
                      />
                    </InputGroup>
                    <FormErrorMessage>{errors.name}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={errors.phone} isRequired>
                    <FormLabel>電話號碼</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <PhoneIcon color="gray.400" />
                      </InputLeftElement>
                      <Input
                        name="phone"
                        type="tel"
                        placeholder="請輸入10位電話號碼"
                        value={formData.phone}
                        onChange={handleChange}
                        maxLength={10}
                        size="lg"
                      />
                    </InputGroup>
                    <FormErrorMessage>{errors.phone}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={errors.room} isRequired>
                    <FormLabel>房間號</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <Icon as={FaHome} color="gray.400" />
                      </InputLeftElement>
                      <Input
                        name="room"
                        placeholder="請輸入房間號"
                        value={formData.room}
                        onChange={handleChange}
                        size="lg"
                      />
                    </InputGroup>
                    <FormErrorMessage>{errors.room}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={errors.password} isRequired>
                    <FormLabel>密碼</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <LockIcon color="gray.400" />
                      </InputLeftElement>
                      <Input
                        name="password"
                        type="password"
                        placeholder="請輸入密碼（至少6位）"
                        value={formData.password}
                        onChange={handleChange}
                        size="lg"
                      />
                    </InputGroup>
                    <FormErrorMessage>{errors.password}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={errors.confirmPassword} isRequired>
                    <FormLabel>確認密碼</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none">
                        <LockIcon color="gray.400" />
                      </InputLeftElement>
                      <Input
                        name="confirmPassword"
                        type="password"
                        placeholder="請再次輸入密碼"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        size="lg"
                      />
                    </InputGroup>
                    <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
                  </FormControl>

                  <Button
                    type="submit"
                    colorScheme="blue"
                    size="lg"
                    w="100%"
                    isLoading={loading}
                    loadingText="註冊中..."
                  >
                    註冊
                  </Button>
                </VStack>
              </form>
            </CardBody>
            <CardFooter justifyContent="center">
              <Text color="gray.600">
                已有帳戶？
                <Link color="blue.500" ml={2} onClick={() => navigate('/login')}>
                  立即登錄
                </Link>
              </Text>
            </CardFooter>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Register;