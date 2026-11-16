// Placeholder for a use case that has not been built yet. Replace the
// <ComingSoon /> element for that route in App.jsx with the real page.
//   <ComingSoon title="My games" />            (same props as before)
import { ArrowLeft } from 'lucide-react';
import { homePath, useAuth } from '../auth/AuthContext.jsx';
import { Button, EmptyState, Icon, Page } from '../components/v2/index.js';

export default function ComingSoon({ title, text = 'This page has not been built yet.' }) {
  const { user } = useAuth();
  return (
    <Page title={title}>
      <EmptyState
        title="Warming up."
        action={
          <Button to={homePath(user?.role)} variant="secondary">
            <Icon icon={ArrowLeft} tone="label" size="16px" />
            Back to my home page
          </Button>
        }
      >
        {text}
      </EmptyState>
    </Page>
  );
}
