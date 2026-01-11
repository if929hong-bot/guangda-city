// src/components/AdminDashboard.jsx
import {
  Box,
  Button,
  Image,
  SimpleGrid,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
  useAPI,
  getImagesViaAPI,
  getImagesFromLocal,
  deleteImageViaAPI,
  deleteImageFromLocal,
} from '../utils/storage';

export default function AdminDashboard({ room }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const loadImages = async () => {
    try {
      setLoading(true);
      const data = useAPI
        ? await getImagesViaAPI(room)
        : getImagesFromLocal(room);
      setImages(data);
    } catch (err) {
      toast({
        title: '讀取失敗',
        description: err.message,
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [room]);

  const handleDelete = async (img) => {
    try {
      if (useAPI) {
        await deleteImageViaAPI(img.fileId);
      } else {
        deleteImageFromLocal(room, img.id);
      }

      setImages((prev) =>
        prev.filter((i) => (useAPI ? i.fileId !== img.fileId : i.id !== img.id))
      );

      toast({
        title: '刪除成功',
        status: 'success',
      });
    } catch (err) {
      toast({
        title: '刪除失敗',
        description: err.message,
        status: 'error',
      });
    }
  };

  if (loading) return <Spinner />;

  return (
    <SimpleGrid columns={[1, 2, 3]} spacing={4}>
      {images.map((img) => (
        <Box key={img.fileId || img.id}>
          <Image src={img.fileLink} />
          <Button
            mt={2}
            colorScheme="red"
            onClick={() => handleDelete(img)}
          >
            刪除
          </Button>
        </Box>
      ))}
    </SimpleGrid>
  );
}
