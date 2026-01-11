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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon
} from '@chakra-ui/react';
import { PhoneIcon, LockIcon } from '@chakra-ui/icons';
import { FaUserShield, FaUser } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authenticateUser } from '../utils/storage';

const Login = () => {
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (formData) => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = '請輸入用戶名或電話號碼';
    }
    if (!formData.password) {
      newErrors.password = '請輸入密碼';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUserLogin = async (e) => {
    e.preventDefault();
    if (!validateForm(userForm)) return;
    
    setLoading(true);
    try {
      const user = authenticateUser(userForm.username, userForm.password);
      if (user && user.role === 'user') {
        login(user);
        toast({
          title: '登錄成功',
          description: `歡迎回來，${user.name}`,
          status: 'success',
          duration: 3000,
          isClosable: true
        });
        navigate('/user');
      } else {
        toast({
          title: '登錄失敗',
          description: '用戶名或密碼錯誤',
          status: 'error',
          duration: 3000,
          isClosable: true
        });
      }
    } catch (error) {
      toast({
        title: '登錄錯誤',
        description: '系統錯誤，請稍後再試',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!validateForm(adminForm)) return;
    
    setLoading(true);
    try {
      const user = authenticateUser(adminForm.username, adminForm.password);
      if (user && user.role === 'admin') {
        login(user);
        toast({
          title: '管理員登錄成功',
          description: '歡迎進入後台管理系統',
          status: 'success',
          duration: 3000,
          isClosable: true
        });
        navigate('/admin');
      } else {
        toast({
          title: '登錄失敗',
          description: '管理員帳號或密碼錯誤',
          status: 'error',
          duration: 3000,
          isClosable: true
        });
      }
    } catch (error) {
      toast({
        title: '登錄錯誤',
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
              租客管理系統登錄
            </Text>
          </VStack>

          <Card w="100%" shadow="xl" borderRadius="xl">
            <CardHeader>
              <Heading size="md" color="blue.600" textAlign="center">
                用戶登錄
              </Heading>
            </CardHeader>
            <Divider />
            <CardBody>
              <Tabs colorScheme="blue" isFitted>
                <TabList mb={6}>
                  <Tab>
                    <Icon as={FaUser} mr={2} />
                    租客登錄
                  </Tab>
                  <Tab>
                    <Icon as={FaUserShield} mr={2} />
                    管理員登錄
                  </Tab>
                </TabList>

                <TabPanels>
                  <TabPanel p={0}>
                    <form onSubmit={handleUserLogin}>
                      <VStack spacing={5}>
                        <FormControl isInvalid={errors.username} isRequired>
                          <FormLabel>電話號碼</FormLabel>
                          <InputGroup>
                            <InputLeftElement pointerEvents="none">
                              <PhoneIcon color="gray.400" />
                            </InputLeftElement>
                            <Input
                              name="username"
                              type="tel"
                              placeholder="請輸入您的電話號碼"
                              value={userForm.username}
                              onChange={handleUserChange}
                              size="lg"
                            />
                          </InputGroup>
                          <FormErrorMessage>{errors.username}</FormErrorMessage>
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
                              placeholder="請輸入密碼"
                              value={userForm.password}
                              onChange={handleUserChange}
                              size="lg"
                            />
                          </InputGroup>
                          <FormErrorMessage>{errors.password}</FormErrorMessage>
                        </FormControl>

                        <Button
                          type="submit"
                          colorScheme="blue"
                          size="lg"
                          w="100%"
                          isLoading={loading}
                          loadingText="登錄中..."
                        >
                          登錄
                        </Button>
                      </VStack>
                    </form>
                  </TabPanel>

                  <TabPanel p={0}>
                    <form onSubmit={handleAdminLogin}>
                      <VStack spacing={5}>
                        <FormControl isInvalid={errors.username} isRequired>
                          <FormLabel>管理員帳號</FormLabel>
                          <InputGroup>
                            <InputLeftElement pointerEvents="none">
                              <Icon as={FaUserShield} color="gray.400" />
                            </InputLeftElement>
                            <Input
                              name="username"
                              placeholder="請輸入管理員帳號"
                              value={adminForm.username}
                              onChange={handleAdminChange}
                              size="lg"
                            />
                          </InputGroup>
                          <FormErrorMessage>{errors.username}</FormErrorMessage>
                        </FormControl>

                        <FormControl isInvalid={errors.password} isRequired>
                          <FormLabel>管理員密碼</FormLabel>
                          <InputGroup>
                            <InputLeftElement pointerEvents="none">
                              <LockIcon color="gray.400" />
                            </InputLeftElement>
                            <Input
                              name="password"
                              type="password"
                              placeholder="請輸入管理員密碼"
                              value={adminForm.password}
                              onChange={handleAdminChange}
                              size="lg"
                            />
                          </InputGroup>
                          <FormErrorMessage>{errors.password}</FormErrorMessage>
                        </FormControl>

                        <Button
                          type="submit"
                          colorScheme="purple"
                          size="lg"
                          w="100%"
                          isLoading={loading}
                          loadingText="登錄中..."
                        >
                          管理員登錄
                        </Button>
                      </VStack>
                    </form>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
            <CardFooter justifyContent="center">
              <Text color="gray.600">
                還沒有帳戶？
                <Link color="blue.500" ml={2} onClick={() => navigate('/register')}>
                  立即註冊
                </Link>
              </Text>
            </CardFooter>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
};

export default Login;