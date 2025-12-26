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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Badge,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  IconButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { DeleteIcon, ViewIcon } from '@chakra-ui/icons';
import { useAuth } from '../context/AuthContext';
import {
  getUsers,
  deleteUser,
  getAllAlbumsWithUserInfo,
  deleteImage
} from '../utils/storage';

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isAlbumOpen,
    onOpen: onAlbumOpen,
    onClose: onAlbumClose
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose
  } = useDisclosure();
  const cancelRef = React.useRef();
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allUsers = getUsers().filter(u => u.role !== 'admin');
    const allAlbums = getAllAlbumsWithUserInfo();
    setUsers(allUsers);
    setAlbums(allAlbums);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    onOpen();
  };

  const handleDeleteUser = (userId) => {
    setDeleteTarget({ type: 'user', id: userId });
    onDeleteOpen();
  };

  const handleDeleteImage = (imageId) => {
    setDeleteTarget({ type: 'image', id: imageId });
    onDeleteOpen();
  };

  const confirmDelete = () => {
    if (deleteTarget.type === 'user') {
      deleteUser(deleteTarget.id);
      toast({
        title: '刪除成功',
        description: '用戶已被刪除',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } else if (deleteTarget.type === 'image') {
      deleteImage(deleteTarget.id);
      toast({
        title: '刪除成功',
        description: '圖片已被刪除',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    }
    loadData();
    onDeleteClose();
    setDeleteTarget(null);
  };

  const handleViewAlbum = (userId) => {
    const userAlbums = albums.filter(a => a.userId === userId);
    setSelectedAlbum(userAlbums);
    onAlbumOpen();
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
          <HStack justify="space-between">
            <Heading size="xl" color="blue.600">
              廣大城租客管理 - 管理員後台
            </Heading>
            <Button colorScheme="red" onClick={logout}>
              登出
            </Button>
          </HStack>

          <Grid templateColumns="repeat(3, 1fr)" gap={6}>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>總用戶數</StatLabel>
                <StatNumber color="blue.600">{users.length}</StatNumber>
                <StatHelpText>已註冊租客</StatHelpText>
              </Stat>
            </GridItem>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>總圖片數</StatLabel>
                <StatNumber color="green.600">{albums.length}</StatNumber>
                <StatHelpText>所有相簿</StatHelpText>
              </Stat>
            </GridItem>
            <GridItem>
              <Stat bg="white" p={6} borderRadius="lg" shadow="md">
                <StatLabel>當前管理員</StatLabel>
                <StatNumber fontSize="lg">{currentUser?.name}</StatNumber>
                <StatHelpText>系統管理員</StatHelpText>
              </Stat>
            </GridItem>
          </Grid>

          <Tabs colorScheme="blue" bg="white" borderRadius="lg" shadow="md">
            <TabList>
              <Tab>用戶管理</Tab>
              <Tab>相簿管理</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <TableContainer>
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>姓名</Th>
                        <Th>電話</Th>
                        <Th>房間</Th>
                        <Th>註冊時間</Th>
                        <Th>操作</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {users.map(user => (
                        <Tr key={user.id}>
                          <Td>{user.name}</Td>
                          <Td>{user.phone}</Td>
                          <Td>
                            <Badge colorScheme="blue">{user.room}</Badge>
                          </Td>
                          <Td>{formatDate(user.createdAt)}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <IconButton
                                size="sm"
                                colorScheme="blue"
                                icon={<ViewIcon />}
                                onClick={() => handleViewUser(user)}
                              />
                              <IconButton
                                size="sm"
                                colorScheme="green"
                                icon={<ViewIcon />}
                                onClick={() => handleViewAlbum(user.id)}
                              />
                              <IconButton
                                size="sm"
                                colorScheme="red"
                                icon={<DeleteIcon />}
                                onClick={() => handleDeleteUser(user.id)}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </TabPanel>

              <TabPanel>
                <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                  {albums.map(album => (
                    <GridItem key={album.id}>
                      <Box
                        borderWidth={1}
                        borderRadius="lg"
                        overflow="hidden"
                        shadow="md"
                        bg="white"
                      >
                        <Image
                          src={album.url}
                          alt="相簿圖片"
                          h="200px"
                          w="100%"
                          objectFit="cover"
                        />
                        <Box p={3}>
                          <Text fontWeight="bold">{album.userName}</Text>
                          <Text fontSize="sm" color="gray.600">
                            房間：{album.userRoom}
                          </Text>
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            {formatDate(album.uploadDate)}
                          </Text>
                          <Button
                            size="sm"
                            colorScheme="red"
                            leftIcon={<DeleteIcon />}
                            mt={2}
                            w="100%"
                            onClick={() => handleDeleteImage(album.id)}
                          >
                            刪除
                          </Button>
                        </Box>
                      </Box>
                    </GridItem>
                  ))}
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>

        <Modal isOpen={isOpen} onClose={onClose} size="md">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>用戶詳情</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              {selectedUser && (
                <VStack align="start" spacing={3}>
                  <Text>
                    <strong>姓名：</strong>
                    {selectedUser.name}
                  </Text>
                  <Text>
                    <strong>電話：</strong>
                    {selectedUser.phone}
                  </Text>
                  <Text>
                    <strong>房間：</strong>
                    {selectedUser.room}
                  </Text>
                  <Text>
                    <strong>註冊時間：</strong>
                    {formatDate(selectedUser.createdAt)}
                  </Text>
                </VStack>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        <Modal isOpen={isAlbumOpen} onClose={onAlbumClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>用戶相簿</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                {selectedAlbum?.map(album => (
                  <GridItem key={album.id}>
                    <Box borderWidth={1} borderRadius="lg" overflow="hidden">
                      <Image
                        src={album.url}
                        alt="相簿"
                        h="150px"
                        w="100%"
                        objectFit="cover"
                      />
                      <Box p={2}>
                        <Text fontSize="xs" color="gray.600">
                          {formatDate(album.uploadDate)}
                        </Text>
                      </Box>
                    </Box>
                  </GridItem>
                ))}
              </Grid>
            </ModalBody>
          </ModalContent>
        </Modal>

        <AlertDialog
          isOpen={isDeleteOpen}
          leastDestructiveRef={cancelRef}
          onClose={onDeleteClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader>確認刪除</AlertDialogHeader>
              <AlertDialogBody>
                您確定要刪除此{deleteTarget?.type === 'user' ? '用戶' : '圖片'}
                嗎？此操作無法撤銷。
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button ref={cancelRef} onClick={onDeleteClose}>
                  取消
                </Button>
                <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                  確認刪除
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </Container>
    </Box>
  );
};

export default AdminDashboard;