import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemCard, PageFrame, PageHeader, PrimaryLink, SecondaryLink, SectionGrid, SectionTitle, Stat } from "@/components/page-kit";
import { siteConfig } from "@/lib/site";
import { siteContent, targetUsers, userJourneys } from "@/lib/content";

const principles = [
  {
    title: "Built around real course materials",
    description:
      "Knorvex starts from notes, slides, textbooks, and past papers so practice stays close to what students actually study."
  },
  {
    title: "Professor-style practice",
    description:
      "Agents capture exam tone, marking style, question formats, and recurring traps without turning the product into a chatbot playground."
  },
  {
    title: "Progress that changes behavior",
    description:
      "Practice sessions, flashcards, and reviews point students back to weak topics instead of burying them in generic analytics."
  }
];

export default function AboutPage() {
  return (
    <PageFrame>
      <PageHeader
        title="A calmer way to prepare for demanding exams"
        description={siteContent.promise}
        actions={
          <>
            <PrimaryLink href="/sign-up">Try it free</PrimaryLink>
            <SecondaryLink href="/faq">Read FAQ</SecondaryLink>
          </>
        }
      />
      <SectionGrid>
        <Stat label="Study modes" value="4+" />
        <Stat label="Assessment formats" value="7+" tone="success" />
        <Stat label="Community groups" value="200+" tone="warning" />
      </SectionGrid>

      <Card className="mt-8 rounded-2xl border-border bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Our core promise</CardTitle>
          <CardDescription className="text-base">&ldquo;{siteContent.tagline}&rdquo;</CardDescription>
        </CardHeader>
      </Card>

      <SectionTitle title={`Who ${siteConfig.name} is for`} />
      <SectionGrid>
        {targetUsers.map((user) => (
          <ItemCard key={user.title} title={user.title} description={user.description} />
        ))}
      </SectionGrid>

      <SectionTitle title="Product principles" />
      <SectionGrid>
        {principles.map((p) => (
          <ItemCard key={p.title} title={p.title} description={p.description} />
        ))}
      </SectionGrid>

      <SectionTitle title="Core user journeys" />
      <div className="grid gap-6 md:grid-cols-3">
        {userJourneys.map((journey) => (
          <Card key={journey.title} className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">{journey.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {journey.steps.map((step) => (
                  <li key={step} className="text-sm text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageFrame>
  );
}
