// src/components/UserHome.jsx
import {
  Box,
  Button,
  Input,
  Image,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import {
  useAPI,
  addImageViaAPI,
  addImageToLocal,
  getImagesViaAPI,
  getImagesFromLocal,
} from '../utils/storage';

export default function UserHome({ room }) {
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
        title: '圖片加載失敗',
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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);

      let newImage;
      if (useAPI) {
        newImage = await addImageViaAPI(file, room);
      } else {
        newImage = {
          id: Date.now(),
          fileLink: URL.createObjectURL(file),
        };
        addImageToLocal(room, newImage);
      }

      setImages((prev) => [...prev, newImage]);

      toast({
        title: '上傳成功',
        status: 'success',
      });
    } catch (err) {
      toast({
        title: '上傳失敗',
        description: err.message,
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={6}>
      <Input type="file" accept="image/*" onChange={handleFileSelect} />

      {loading && (
        <Box mt={4}>
          <Spinner />
        </Box>
      )}

      <SimpleGrid columns={[1, 2, 3]} spacing={4} mt={6}>
        {images.map((img) => (
          <Box key={img.fileId || img.id}>
            <Image src={img.fileLink} borderRadius="md" />
            <Text fontSize="sm">{img.fileName}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
