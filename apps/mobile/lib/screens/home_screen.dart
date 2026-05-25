import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/language_switcher.dart';
import '../widgets/sync_status_badge.dart';
import 'jobs_screen.dart';
import 'inventory_screen.dart';
import 'certificates_screen.dart';
import 'drills_screen.dart';
import 'checklists_screen.dart';
import 'rest_hours_screen.dart';
import 'flgo_screen.dart';
import 'discharge_logs_screen.dart';
import 'jhas_screen.dart';
import 'voyage_legs_screen.dart';
import 'audit_findings_screen.dart';
import 'safety_equipment_screen.dart';
import 'conditions_of_class_screen.dart';
import 'inspections_screen.dart';
import 'surveys_screen.dart';
import 'qhse_objectives_screen.dart';
import 'audits_screen.dart';
import 'drybms_elements_screen.dart';
import 'management_reviews_screen.dart';
import 'purchase_orders_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTab = 0;

  static const _screens = <Widget>[
    JobsScreen(),
    InventoryScreen(),
    CertificatesScreen(),
    DrillsScreen(),
    ChecklistsScreen(),
    RestHoursScreen(),
    FlgoScreen(),
  ];

  void _openDrawerDestination(Widget screen) {
    Navigator.of(context).pop(); // close drawer
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text('app.name'.tr()),
        actions: [
          const SyncStatusBadge(),
          const LanguageSwitcher(),
          if (auth.email != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(
                child: Text(
                  auth.email!,
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'auth.sign_out'.tr(),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: Text('auth.sign_out'.tr()),
                  content: Text('auth.sign_out_confirm'.tr()),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      child: Text('common.cancel'.tr()),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      child: Text('auth.sign_out'.tr()),
                    ),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                context.read<AuthProvider>().logout();
              }
            },
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF0A1F33)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('app.name'.tr(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold)),
                  Text('app.tagline'.tr(),
                      style: const TextStyle(color: Colors.white70)),
                ],
              ),
            ),
            _DrawerSection('drawer.section_quick_logs'.tr()),
            ListTile(
              leading: const Icon(Icons.water_outlined),
              title: Text('drawer.discharge_logs'.tr()),
              onTap: () => _openDrawerDestination(const DischargeLogsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.warning_amber_outlined),
              title: Text('drawer.jhas'.tr()),
              onTap: () => _openDrawerDestination(const JhasScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.directions_boat_outlined),
              title: Text('drawer.voyage_legs'.tr()),
              onTap: () => _openDrawerDestination(const VoyageLegsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.security_outlined),
              title: Text('drawer.inspections'.tr()),
              onTap: () => _openDrawerDestination(const InspectionsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.shopping_cart_outlined),
              title: Text('purchase.title'.tr()),
              onTap: () => _openDrawerDestination(const PurchaseOrdersScreen()),
            ),
            const Divider(),
            _DrawerSection('drawer.section_records'.tr()),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: Text('drawer.audit_findings'.tr()),
              onTap: () => _openDrawerDestination(const AuditFindingsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.health_and_safety_outlined),
              title: Text('drawer.safety_equipment'.tr()),
              onTap: () => _openDrawerDestination(const SafetyEquipmentScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.gavel_outlined),
              title: Text('drawer.conditions_of_class'.tr()),
              onTap: () => _openDrawerDestination(const ConditionsOfClassScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.assignment_outlined),
              title: Text('drawer.surveys'.tr()),
              onTap: () => _openDrawerDestination(const SurveysScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.fact_check_outlined),
              title: Text('drawer.audits'.tr()),
              onTap: () => _openDrawerDestination(const AuditsScreen()),
            ),
            const Divider(),
            _DrawerSection('drawer.section_office'.tr()),
            ListTile(
              leading: const Icon(Icons.track_changes_outlined),
              title: Text('drawer.qhse_objectives'.tr()),
              onTap: () => _openDrawerDestination(const QhseObjectivesScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.fact_check_outlined),
              title: Text('drawer.drybms_elements'.tr()),
              onTap: () => _openDrawerDestination(const DrybmsElementsScreen()),
            ),
            ListTile(
              leading: const Icon(Icons.event_note_outlined),
              title: Text('drawer.management_reviews'.tr()),
              onTap: () => _openDrawerDestination(const ManagementReviewsScreen()),
            ),
          ],
        ),
      ),
      body: IndexedStack(index: _selectedTab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (i) => setState(() => _selectedTab = i),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.build_outlined),
            selectedIcon: const Icon(Icons.build),
            label: 'nav.jobs'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.inventory_2_outlined),
            selectedIcon: const Icon(Icons.inventory_2),
            label: 'nav.inventory'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.verified_outlined),
            selectedIcon: const Icon(Icons.verified),
            label: 'nav.certs'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.local_fire_department_outlined),
            selectedIcon: const Icon(Icons.local_fire_department),
            label: 'nav.drills'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.checklist_outlined),
            selectedIcon: const Icon(Icons.checklist),
            label: 'nav.qhse'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.access_time_outlined),
            selectedIcon: const Icon(Icons.access_time_filled),
            label: 'nav.rest_hours'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.water_drop_outlined),
            selectedIcon: const Icon(Icons.water_drop),
            label: 'nav.flgo'.tr(),
          ),
        ],
      ),
    );
  }
}

class _DrawerSection extends StatelessWidget {
  final String title;
  const _DrawerSection(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        child: Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            color: Colors.grey[600],
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
      );
}
