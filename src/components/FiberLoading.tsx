import React from 'react';
import Preloader, { PreloaderProps } from './Preloader';

interface FiberLoadingProps extends PreloaderProps {}

export default function FiberLoading(props: FiberLoadingProps) {
  return <Preloader {...props} />;
}
