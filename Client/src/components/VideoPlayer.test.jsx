import { render, screen } from '@testing-library/react';
import VideoPlayer from './VideoPlayer';

test('renders video player component', () => {
  render(<VideoPlayer />); // Renders the component
  const videoElement = screen.getByRole('video'); // Finds video element
  expect(videoElement).toBeInTheDocument(); // Checks it exists
});