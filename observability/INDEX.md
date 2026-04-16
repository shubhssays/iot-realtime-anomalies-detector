# 📚 Documentation Index

Welcome to the OpenObserve Observability Stack documentation!

## 🚀 Quick Links

- **[Getting Started](GETTING_STARTED.md)** - Start here! Get up and running in 5 minutes
- **[README](README.md)** - Complete comprehensive guide (main documentation)
- **[Quick Reference](QUICK_REFERENCE.md)** - Commands, URLs, and queries at a glance

## 📖 Detailed Documentation

### Setup & Configuration

- **[Getting Started Guide](GETTING_STARTED.md)**
  - Prerequisites
  - Installation methods
  - First steps
  - Verification
  - Quick wins

- **[Complete Setup Guide](README.md)**
  - Architecture overview
  - Configuration files explained
  - Sample applications
  - Advanced configuration
  - Performance tuning
  - Security best practices

### Architecture & Design

- **[Architecture Documentation](ARCHITECTURE.md)**
  - High-level architecture diagram
  - Data flow diagrams
  - Network topology
  - Component details
  - Security architecture
  - Scaling considerations

### Operations

- **[Quick Reference](QUICK_REFERENCE.md)**
  - Quick commands
  - URLs & credentials
  - Port reference
  - Sample endpoints
  - Query examples
  - Debugging commands

- **[Troubleshooting Guide](TROUBLESHOOTING.md)**
  - Common issues & solutions
  - Diagnostic checklist
  - Log analysis
  - Performance issues
  - Advanced debugging

## 📁 File Structure

```
observability/
├── README.md                    # Main documentation (comprehensive)
├── GETTING_STARTED.md          # Quick start guide (5-minute setup)
├── ARCHITECTURE.md             # Architecture diagrams and details
├── TROUBLESHOOTING.md          # Common issues and solutions
├── QUICK_REFERENCE.md          # Commands and queries cheat sheet
├── INDEX.md                    # This file - navigation guide
│
├── docker-compose.yml          # Main orchestration file
├── setup.sh                    # Automated setup script
├── generate-traffic.sh         # Traffic generation script
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore patterns
│
├── config/
│   └── otel-collector-config.yaml    # OpenTelemetry Collector config
│
└── apps/
    ├── nodejs-sample/          # Node.js sample app
    │   ├── package.json
    │   ├── tracing.js          # OpenTelemetry setup
    │   ├── index.js            # Application code
    │   └── Dockerfile
    │
    └── python-sample/          # Python sample app
        ├── requirements.txt
        ├── tracing.py          # OpenTelemetry setup
        ├── main.py             # Application code
        └── Dockerfile
```

## 🎯 Documentation by Task

### I want to...

#### Get started quickly
→ Read [Getting Started](GETTING_STARTED.md)

#### Understand the architecture
→ Read [Architecture](ARCHITECTURE.md)

#### Look up a command or URL
→ Check [Quick Reference](QUICK_REFERENCE.md)

#### Fix a problem
→ Check [Troubleshooting](TROUBLESHOOTING.md)

#### Learn everything in detail
→ Read the complete [README](README.md)

#### Configure the collector
→ Edit `config/otel-collector-config.yaml` and see [README](README.md#configuration-files)

#### Add my own application
→ See sample apps in `apps/` and [README](README.md#sample-applications)

#### Optimize performance
→ See [README](README.md#performance--best-practices)

#### Scale the stack
→ See [Architecture](ARCHITECTURE.md#scaling-considerations)

#### Secure the stack
→ See [README](README.md#performance--best-practices) security section

## 🔗 External Resources

- [OpenObserve Documentation](https://openobserve.ai/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)

## 📊 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| README.md | ✅ Complete | 2024-01-15 |
| GETTING_STARTED.md | ✅ Complete | 2024-01-15 |
| ARCHITECTURE.md | ✅ Complete | 2024-01-15 |
| TROUBLESHOOTING.md | ✅ Complete | 2024-01-15 |
| QUICK_REFERENCE.md | ✅ Complete | 2024-01-15 |

## 💡 Tips

- **New users**: Start with [Getting Started](GETTING_STARTED.md)
- **Experienced users**: Use [Quick Reference](QUICK_REFERENCE.md) for commands
- **Troubleshooting**: Check [Troubleshooting Guide](TROUBLESHOOTING.md) first
- **Deep dive**: Read the complete [README](README.md)

---

**Need help?** Check the [Troubleshooting Guide](TROUBLESHOOTING.md) or review the logs with `docker compose logs`.
