import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 p-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>@repo/ui + shadcn/ui</CardTitle>
            <CardDescription>
              Every shadcn/ui component lives in{" "}
              <code className="text-foreground">packages/ui</code> and is
              imported straight from <code className="text-foreground">@repo/ui</code>.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="buttons">
              <TabsList>
                <TabsTrigger value="buttons">Buttons</TabsTrigger>
                <TabsTrigger value="form">Form</TabsTrigger>
              </TabsList>

              <TabsContent value="buttons" className="flex flex-col gap-4 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setCount((current) => current + 1)}>
                    Count is {count}
                  </Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline">Hover me</Button>
                    </TooltipTrigger>
                    <TooltipContent>Tooltips work too</TooltipContent>
                  </Tooltip>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Shared dialog</DialogTitle>
                        <DialogDescription>
                          Rendered by a component from{" "}
                          <code>packages/ui</code>.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button>Confirm</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </TabsContent>

              <TabsContent value="form" className="flex flex-col gap-4 pt-4">
                <Input placeholder="Type something..." />
                <Input placeholder="Disabled" disabled />
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="text-muted-foreground text-sm">
            Edit <code className="text-foreground">src/App.tsx</code> to get
            started.
          </CardFooter>
        </Card>
      </main>
    </TooltipProvider>
  );
}

export default App;
