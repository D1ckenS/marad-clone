import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/models/job_instance.dart';
import 'package:fleetops_mobile/models/inventory_item.dart';

void main() {
  group('JobInstance.fromJson', () {
    test('parses all fields', () {
      final ji = JobInstance.fromJson({
        'id': 'ji-1',
        'jobId': 'job-1',
        'componentId': 'comp-1',
        'status': 'PENDING',
        'dueAt': '2026-06-15T12:00:00.000Z',
        'assignedToUserId': 'user-1',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });
      expect(ji.id, 'ji-1');
      expect(ji.jobId, 'job-1');
      expect(ji.status, 'PENDING');
      expect(ji.isPending, isTrue);
      expect(ji.isDone, isFalse);
      expect(ji.isInProgress, isFalse);
      expect(ji.dueAt, isNotNull);
    });

    test('handles null dueAt', () {
      final ji = JobInstance.fromJson({
        'id': 'ji-2',
        'jobId': 'job-1',
        'componentId': 'comp-1',
        'status': 'DONE',
        'dueAt': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });
      expect(ji.dueAt, isNull);
      expect(ji.isDone, isTrue);
    });

    test('recognises IN_PROGRESS status', () {
      final ji = JobInstance.fromJson({
        'id': 'ji-3',
        'jobId': 'job-1',
        'componentId': 'comp-1',
        'status': 'IN_PROGRESS',
        'dueAt': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });
      expect(ji.isInProgress, isTrue);
      expect(ji.isPending, isFalse);
    });
  });

  group('JobModel.fromJson', () {
    test('parses required fields', () {
      final job = JobModel.fromJson({
        'id': 'job-1',
        'componentId': 'comp-1',
        'title': 'Monthly Inspection',
        'description': 'Check all filters',
        'priority': 'HIGH',
      });
      expect(job.title, 'Monthly Inspection');
      expect(job.priority, 'HIGH');
      expect(job.description, 'Check all filters');
    });

    test('defaults priority to NORMAL when absent', () {
      final job = JobModel.fromJson({
        'id': 'job-2',
        'componentId': 'comp-1',
        'title': 'Oil Change',
      });
      expect(job.priority, 'NORMAL');
    });
  });

  group('InventoryItem.fromJson', () {
    test('parses with stockLevels', () {
      final item = InventoryItem.fromJson({
        'id': 'part-1',
        'partNumber': 'OIL-001',
        'name': 'Engine Oil',
        'unit': 'L',
        'stockLevels': [
          {
            'id': 'lvl-1',
            'locationId': 'loc-1',
            'locationName': 'Engine Room',
            'rob': '45.5',
            'status': 'green',
            'minStock': '5',
            'maxStock': '100',
            'reorderPoint': '10',
          },
        ],
      });
      expect(item.id, 'part-1');
      expect(item.partNumber, 'OIL-001');
      expect(item.unit, 'L');
      expect(item.stockLevels.length, 1);
      expect(item.stockLevels.first.rob, 45.5);
      expect(item.stockLevels.first.locationName, 'Engine Room');
      expect(item.overallStatus, 'green');
    });

    test('overallStatus is purple when no stockLevels', () {
      final item = InventoryItem.fromJson({
        'id': 'part-2',
        'partNumber': 'PART-X',
        'name': 'Spare Part',
        'stockLevels': [],
      });
      expect(item.overallStatus, 'purple');
    });

    test('overallStatus propagates worst status (red wins)', () {
      final item = InventoryItem.fromJson({
        'id': 'part-3',
        'partNumber': 'FILTER-001',
        'name': 'Oil Filter',
        'stockLevels': [
          {
            'id': 'lvl-1',
            'locationId': 'loc-1',
            'locationName': 'Store',
            'rob': '0',
            'status': 'red',
          },
          {
            'id': 'lvl-2',
            'locationId': 'loc-2',
            'locationName': 'Workshop',
            'rob': '5',
            'status': 'green',
          },
        ],
      });
      expect(item.overallStatus, 'red');
    });

    test('overallStatus amber beats green', () {
      final item = InventoryItem.fromJson({
        'id': 'part-4',
        'partNumber': 'BELT-001',
        'name': 'Drive Belt',
        'stockLevels': [
          {
            'id': 'lvl-1',
            'locationId': 'loc-1',
            'locationName': 'Store',
            'rob': '2',
            'status': 'amber',
          },
          {
            'id': 'lvl-2',
            'locationId': 'loc-2',
            'locationName': 'Workshop',
            'rob': '10',
            'status': 'green',
          },
        ],
      });
      expect(item.overallStatus, 'amber');
    });
  });

  group('StockLevelEntry.fromJson', () {
    test('parses rob as double from string', () {
      final entry = StockLevelEntry.fromJson({
        'id': 'lvl-1',
        'locationId': 'loc-1',
        'locationName': 'Store',
        'rob': '12.75',
        'status': 'green',
      });
      expect(entry.rob, closeTo(12.75, 0.001));
    });

    test('defaults status to green when absent', () {
      final entry = StockLevelEntry.fromJson({
        'id': 'lvl-1',
        'locationId': 'loc-1',
        'locationName': 'Store',
        'rob': '0',
      });
      expect(entry.status, 'green');
    });
  });
}
