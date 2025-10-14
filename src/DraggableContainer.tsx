

import React, { useState, useCallback, RefObject } from 'react';
import { Box } from '@mui/material';

interface DraggableContainerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export default function DraggableContainer({
  containerRef,
  children,
}: DraggableContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isTouching, setIsTouching] = useState(false);

  const handleStart = useCallback(
    (clientX: number) => {
      setIsDragging(true);
      setStartX(clientX - (containerRef?.current?.offsetLeft ?? 0));
      setScrollLeft(containerRef?.current?.scrollLeft ?? 0);
    },
    [containerRef],
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
    setIsTouching(false);
  }, []);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging && !isTouching) return;
      const x = clientX - (containerRef?.current?.offsetLeft ?? 0);
      const distance = x - startX;
      if (containerRef?.current) {
        containerRef.current.scrollLeft = scrollLeft - distance;
      }
    },
    [isDragging, isTouching, containerRef, startX, scrollLeft],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.pageX);
    },
    [handleStart],
  );

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleMove(e.pageX);
    },
    [handleMove],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      setIsTouching(true);
      handleStart(e.touches[0].clientX);
    },
    [handleStart],
  );

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove],
  );

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      sx={{
        overflowX: 'auto',
        overflowY: 'hidden',
        cursor: isDragging || isTouching ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitOverflowScrolling: 'touch',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {children}
    </Box>
  );
}
