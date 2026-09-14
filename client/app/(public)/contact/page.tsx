"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemCard, Label, PageFrame, PageHeader, SectionTitle, Textarea } from "@/components/page-kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const channels = [
  {
    title: "Product support",
    description: "Questions about uploads, generated questions, billing, or account access.",
    meta: "support@knorvex.com"
  },
  {
    title: "Partnerships",
    description: "Study groups, tutors, and education teams exploring shared Knorvex workflows.",
    meta: "partners@knorvex.com"
  },
  {
    title: "Community moderation",
    description: "Report content issues, group disputes, or moderation appeals.",
    meta: "moderation@knorvex.com"
  }
];

const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
  email: z.string().trim().email("Please enter a valid email address."),
  message: z.string().trim().min(5, "Message must be at least 5 characters.").max(2000, "Message is too long."),
  topic: z.enum(["product", "partnerships", "moderation"]).optional()
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid }
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", message: "", topic: "product" }
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      const res = await apiRequest<{ success: boolean; message: string }>("/contact", {
        method: "POST",
        body: JSON.stringify(values)
      });
      showSuccess(res.message || "Message sent successfully.");
      reset({ name: "", email: "", message: "", topic: "product" });
    } catch (err) {
      showError(err, "Failed to send message. Please try again.");
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="Get help with your study workflow"
        description="Send a note with the course, file type, or workflow you are setting up. Our team responds within 1-2 business days."
      />
      <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionTitle title="Support channels" />
          <div className="space-y-4">
            {channels.map((channel) => (
              <ItemCard key={channel.title} title={channel.title} description={channel.description} meta={channel.meta} />
            ))}
          </div>
        </div>
        <Card className="rounded-2xl shadow-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Send a message</CardTitle>
            <CardDescription>Include your course, file type, and what you are trying to accomplish.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    disabled={isSubmitting}
                    {...register("name")}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                    {...register("email")}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (optional)</Label>
                <Controller
                  control={control}
                  name="topic"
                  render={({ field }) => (
                    <Select
                      disabled={isSubmitting}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="topic">
                        <SelectValue placeholder="Select a topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Product support</SelectItem>
                        <SelectItem value="partnerships">Partnerships</SelectItem>
                        <SelectItem value="moderation">Community moderation</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.topic && <p className="text-xs text-danger">{errors.topic.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  placeholder="Tell us what you need help with."
                  disabled={isSubmitting}
                  {...register("message")}
                  aria-invalid={Boolean(errors.message)}
                />
                {errors.message && <p className="text-xs text-danger">{errors.message.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting || !isValid} className="rounded-full">
                {isSubmitting ? "Sending..." : "Send message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </PageFrame>
  );
}
