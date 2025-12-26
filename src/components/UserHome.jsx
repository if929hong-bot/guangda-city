import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Image,
  Button,
  Input,
  Grid,
  GridItem,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Card,
  CardBody,
  CardFooter,
  Badge,
  IconButton,
  Spinner,
  Center,
  Avatar,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, ViewIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';
import { getUserAlbums, addImage, deleteImage } from '../utils/storage';

const UserHome = () => {
  const { currentUser, logout } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isUploadOpen,
    onOpen: onUploadOpen,
    onClose: onUploadClose
  } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadAlbums();
  }, [currentUser]);

  const loadAlbums = () => {
    if (currentUser) {
      const userAlbums = getUserAlbums(currentUser.id);
      setAlbums(userAlbums);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: '錯誤',
        description: '請選擇圖片文件',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '錯誤',
        description: '圖片大小不能超過5MB',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      addImage(currentUser.id, reader.result);
      loadAlbums();
      setLoading(false);
      onUploadClose();
      toast({
        title: '上傳成功',
        description: '圖片已添加到您的相簿',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = (imageId) => {
    deleteImage(imageId);
    loadAlbums();
    toast({
      title: '刪除成功',
      description: '圖片已從相簿中移除',
      status: 'success',
      duration: 3000,
      isClosable: true
    });
  };

  const handleViewImage = (image) => {
    setSelectedImage(image);
    onOpen();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="container.xl">
        <VStack spacing={6} align="stretch">
          <HStack justify="space-between" flexWrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Avatar
                name={currentUser?.name}
                size="lg"
                bg="blue.500"
                color="white"
              />
              <VStack align="start" spacing={0}>
                <Heading size="xl" color="blue.600">
                  歡迎回來，{currentUser?.name}
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  廣大城租客管理系統
                </Text>
              </VStack>
            </HStack>
            <Button colorScheme="red" onClick={logout} size="lg">
              登出
            </Button>
          </HStack>

          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>姓名</StatLabel>
                <StatNumber fontSize="xl">{currentUser?.name}</StatNumber>
                <StatHelpText>租客信息</StatHelpText>
              </Stat>
            </GridItem>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>房間</StatLabel>
                <StatNumber fontSize="xl">
                  <Badge colorScheme="blue" fontSize="xl" p={2}>
                    {currentUser?.room}
                  </Badge>
                </StatNumber>
                <StatHelpText>房間號碼</StatHelpText>
              </Stat>
            </GridItem>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>相簿圖片</StatLabel>
                <StatNumber color="green.600">{albums.length}</StatNumber>
                <StatHelpText>已上傳圖片數量</StatHelpText>
              </Stat>
            </GridItem>
          </Grid>

          <Box bg="white" p={6} borderRadius="lg" shadow="md">
            <HStack justify="space-between" mb={6}>
              <Heading size="lg" color="blue.600">
                我的相簿
              </Heading>
              <Button
                leftIcon={<AddIcon />}
                colorScheme="blue"
                onClick={onUploadOpen}
                size="lg"
              >
                上傳圖片
              </Button>
            </HStack>

            {albums.length === 0 ? (
              <Center py={20}>
                <VStack spacing={4}>
                  <Text fontSize="xl" color="gray.500">
                    您還沒有上傳任何圖片
                  </Text>
                  <Button
                    leftIcon={<AddIcon />}
                    colorScheme="blue"
                    onClick={onUploadOpen}
                  >
                    開始上傳
                  </Button>
                </VStack>
              </Center>
            ) : (
              <Grid
                templateColumns={{
                  base: '1fr',
                  md: 'repeat(2, 1fr)',
                  lg: 'repeat(4, 1fr)'
                }}
                gap={6}
              >
                {albums.map((album) => (
                  <GridItem key={album.id}>
                    <Card shadow="md" _hover={{ shadow: 'xl' }} transition="all 0.3s">
                      <CardBody p={0}>
                        <Image
                          src={album.url}
                          alt="相簿圖片"
                          h="200px"
                          w="100%"
                          objectFit="cover"
                          borderTopRadius="md"
                        />
                      </CardBody>
                      <CardFooter flexDirection="column" alignItems="start">
                        <Text fontSize="sm" color="gray.600" mb={2}>
                          上傳時間：{formatDate(album.uploadDate)}
                        </Text>
                        <HStack spacing={2} w="100%">
                          <IconButton
                            icon={<ViewIcon />}
                            colorScheme="blue"
                            size="sm"
                            flex={1}
                            onClick={() => handleViewImage(album)}
                          />
                          <IconButton
                            icon={<DeleteIcon />}
                            colorScheme="red"
                            size="sm"
                            flex={1}
                            onClick={() => handleDeleteImage(album.id)}
                          />
                        </HStack>
                      </CardFooter>
                    </Card>
                  </GridItem>
                ))}
              </Grid>
            )}
          </Box>
        </VStack>

        <Modal isOpen={isUploadOpen} onClose={onUploadClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>上傳圖片</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <FormControl>
                <FormLabel>選擇圖片</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={loading}
                  p={1}
                />
                <Text fontSize="sm" color="gray.500" mt={2}>
                  支持JPG、PNG格式，最大5MB
                </Text>
              </FormControl>
              {loading && (
                <Center mt={4}>
                  <Spinner size="xl" color="blue.500" />
                </Center>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>圖片預覽</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              {selectedImage && (
                <VStack spacing={4}>
                  <Image
                    src={selectedImage.url}
                    alt="預覽圖片"
                    maxH="500px"
                    w="100%"
                    objectFit="contain"
                    borderRadius="md"
                  />
                  <Text color="gray.600">
                    上傳時間：{formatDate(selectedImage.uploadDate)}
                  </Text>
                </VStack>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
};

export default UserHome;