import { BrowserRouter } from 'react-router-dom';
import { SiteRouter } from './router/SiteRouter';

export const SiteApp = () => {
  return (
    <BrowserRouter>
      <SiteRouter />
    </BrowserRouter>
  );
};
