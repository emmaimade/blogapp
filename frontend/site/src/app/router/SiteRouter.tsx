import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../../shared/layouts/PublicLayout';
import { AuthLayout } from '../../shared/layouts/AuthLayout';

import { HomePage } from '../../pages/HomePage';
import { PricingPage } from '../../pages/PricingPage';
import { FeaturesPage } from '../../pages/FeaturesPage';
import { ContactPage } from '../../pages/ContactPage';
import { SignupPage } from '../../pages/SignupPage';
import { AboutPage } from '../../pages/AboutPage';

import { JoinPage } from '../../pages/JoinPage';
import { VerifyEmailPage } from '../../pages/VerifyEmailPage';

export const SiteRouter = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
