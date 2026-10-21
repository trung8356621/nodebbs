'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import React from 'react';
import CopyButton from '@/components/common/CopyButton';
import { Github, Rocket, Bot, Code2, Plug, Settings, Shield, Mail, Zap, QrCode, Copy, Check, Star, GitFork, ArrowRight, Terminal, Award, Gift, MessageCircle, Search, Users, Ticket, Coins, ShieldCheck } from 'lucide-react';
const GITHUB_REPO_URL = 'https://github.com/aiprojecthub/nodebbs';
const CodeBlock = ({
  code,
  language = 'bash'
}) => {
  const pbnT = usePbnTranslations();
  return <div className="relative group overflow-hidden min-w-0 rounded-xl shadow-lg">
      <div className="flex items-center justify-between bg-slate-800 dark:bg-slate-900 px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Terminal className="h-3.5 w-3.5" />
            <span className="font-medium">{language}</span>
          </div>
        </div>
        <CopyButton value={code} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-slate-100 transition-colors h-auto w-auto shrink-0 border border-slate-600/50" title={pbnT("m153")}>
          {({
          copied
        }) => <>
              {copied ? <>
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span>{pbnT("m154")}</span>
                </> : <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{pbnT("m155")}</span>
                </>}
            </>}
        </CopyButton>
      </div>
      <div className="bg-slate-900 dark:bg-slate-950 p-4 font-mono text-sm overflow-x-auto">
        <pre className="text-emerald-400 m-0 whitespace-pre-wrap break-all">
          <span className="text-slate-500 select-none">$ </span>{code}
        </pre>
      </div>
    </div>;
};
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  link,
  linkText
}) => <div className="group relative p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition duration-300">
    <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
    <div className="relative">
      <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-5">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-primary transition-colors group">
          {linkText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </a>}
    </div>
  </div>;
const SmallFeatureCard = ({
  icon: Icon,
  title,
  description
}) => <div className="group flex items-start gap-4 p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-colors duration-300">
    <div className="shrink-0 p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>;
const SectionTitle = ({
  children,
  subtitle
}) => <div className="text-center mb-14">
    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{children}</h2>
    {subtitle && <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
  </div>;
const AboutContent = () => {
  const pbnT = usePbnTranslations();
  return <div className="bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative text-center py-20 md:py-32 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Star className="h-4 w-4" />
              <span>{pbnT("m156")}</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text">{pbnT("m157")}</h1>

            <p className="mt-6 text-xl md:text-2xl text-muted-foreground font-medium">{pbnT("m158")}</p>

            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{pbnT("m159")}</p>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity">
                <Github className="h-5 w-5" />{pbnT("m160")}</a>
              <a href="https://nodebbs.com/reference" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-full font-medium hover:bg-accent transition-colors">
                <Code2 className="h-5 w-5" />{pbnT("m161")}</a>
            </div>
          </div>
        </div>
      </div>

      {/* Open Source & Quick Deploy Section */}
      <div className="py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-6">
                <Rocket className="h-4 w-4" />{pbnT("m162")}</div>

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">{pbnT("m163")}</h2>

              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">{pbnT("m164")}</p>

              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{pbnT("m165")}</p>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">1</span>{pbnT("m166")}</div>
                  <CodeBlock code={`git clone ${GITHUB_REPO_URL}.git`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">2</span>{pbnT("m167")}</div>
                  <CodeBlock code="cd nodebbs && npx nodebbs" />
                </div>
              </div>

              <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-8 text-primary font-medium transition-colors group">
                <Github className="h-5 w-5" />{pbnT("m168")}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl" />
                <div className="relative p-12 rounded-3xl bg-linear-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-border/50">
                  <Github className="h-32 w-32 md:h-40 md:w-40 text-foreground/80" />
                  <div className="flex items-center justify-center gap-6 mt-6">
                    <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-yellow-500 transition-colors">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>Star</span>
                    </a>
                    <a href={`${GITHUB_REPO_URL}/fork`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                      <GitFork className="h-4 w-4" />
                      <span>Fork</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Features Section */}
      <div className="py-20 md:py-28 px-4 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <SectionTitle subtitle={pbnT("m169")}>{pbnT("m170")}</SectionTitle>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard icon={Bot} title={pbnT("m171")} description={pbnT("m172")} />
            <FeatureCard icon={Code2} title={pbnT("m173")} description={pbnT("m174")} link="https://nodebbs.com/reference" linkText={pbnT("m175")} />
            <FeatureCard icon={Settings} title={pbnT("m176")} description={pbnT("m177")} />
          </div>
        </div>
      </div>

      {/* Built-in Features Section */}
      <div className="py-20 md:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <SectionTitle subtitle={pbnT("m178")}>{pbnT("m179")}</SectionTitle>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SmallFeatureCard icon={Shield} title={pbnT("m180")} description={pbnT("m181")} />
            <SmallFeatureCard icon={QrCode} title={pbnT("m182")} description={pbnT("m183")} />
            <SmallFeatureCard icon={Plug} title={pbnT("m184")} description={pbnT("m185")} />
            <SmallFeatureCard icon={ShieldCheck} title={pbnT("m186")} description={pbnT("m187")} />
            <SmallFeatureCard icon={Coins} title={pbnT("m188")} description={pbnT("m189")} />
            <SmallFeatureCard icon={Award} title={pbnT("m190")} description={pbnT("m191")} />
            <SmallFeatureCard icon={Gift} title={pbnT("m192")} description={pbnT("m193")} />
            <SmallFeatureCard icon={MessageCircle} title={pbnT("m194")} description={pbnT("m195")} />
            <SmallFeatureCard icon={Ticket} title={pbnT("m196")} description={pbnT("m197")} />
          </div>
        </div>
      </div>

      {/* Join & Contribute Section */}
      <div className="relative py-20 md:py-28 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Star className="h-4 w-4" />{pbnT("m198")}</div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{pbnT("m199")}</h2>

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{pbnT("m200")}</p>

          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{pbnT("m201")}</p>

          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity shadow-lg">
              <Github className="h-5 w-5" />
              GitHub
            </a>
            <a href="https://nodebbs.com/reference" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-card border border-border rounded-full font-medium hover:bg-accent transition-colors shadow-lg">
              <Code2 className="h-5 w-5" />{pbnT("m161")}</a>
          </div>
        </div>
      </div>
    </div>;
};
export default AboutContent;
