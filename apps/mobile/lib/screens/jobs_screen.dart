import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/job_instance.dart';
import '../services/api_client.dart';
import '../widgets/job_status_badge.dart';
import 'sign_off_screen.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});
  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<JobInstance>? _instances;
  Map<String, JobModel> _jobsById = {};
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = context.read<ApiClient>();
      final instData = await client.get('/job-instances') as List<dynamic>;
      final jobData = await client.get('/jobs') as List<dynamic>;
      setState(() {
        _instances = instData
            .map((e) => JobInstance.fromJson(e as Map<String, dynamic>))
            .toList();
        _jobsById = {
          for (final j in jobData)
            (j as Map<String, dynamic>)['id'] as String: JobModel.fromJson(j)
        };
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach vessel API.\n$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _instances == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    final instances = _instances ?? [];
    if (instances.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle_outline, size: 64, color: Colors.green),
            const SizedBox(height: 12),
            const Text('No jobs assigned.'),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: instances.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (ctx, i) {
          final inst = instances[i];
          final job = _jobsById[inst.jobId];
          final title = job?.title ?? inst.jobId;
          final dueDateStr = inst.dueAt != null
              ? inst.dueAt!.toLocal().toString().split(' ')[0]
              : null;
          return Card(
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (job?.description != null)
                    Text(job!.description!, maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      JobStatusBadge(status: inst.status),
                      if (dueDateStr != null) ...[
                        const SizedBox(width: 8),
                        Icon(Icons.event, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 2),
                        Text(dueDateStr,
                            style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      ],
                    ],
                  ),
                ],
              ),
              trailing: inst.isDone
                  ? null
                  : const Icon(Icons.chevron_right),
              onTap: inst.isDone
                  ? null
                  : () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => SignOffScreen(
                            instance: inst,
                            jobTitle: title,
                          ),
                        ),
                      );
                      _load();
                    },
            ),
          );
        },
      ),
    );
  }
}
