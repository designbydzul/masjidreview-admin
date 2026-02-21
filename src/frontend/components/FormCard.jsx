import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Separator } from './ui/separator';

export default function FormCard({ title, children }) {
  return (
    <Card className="mb-4">
      {title ? (
        <>
          <CardHeader className="pb-3">
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <div className="px-6">
            <Separator />
          </div>
          <CardContent className="pt-4">{children}</CardContent>
        </>
      ) : (
        <CardContent className="pt-6">{children}</CardContent>
      )}
    </Card>
  );
}
