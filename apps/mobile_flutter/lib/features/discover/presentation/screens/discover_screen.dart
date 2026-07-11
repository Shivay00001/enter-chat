import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/widgets/empty_state.dart';

/// Discover tab — browse public channels, communities, and trending content.
///
/// Inspired by:
/// - Telegram: Public channel/group search, bot directory
/// - Discord: Server discovery, categories
/// - WhatsApp: Channel directory with curated picks
class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'all';

  final List<String> _categories = [
    'all',
    'news',
    'entertainment',
    'technology',
    'sports',
    'education',
    'lifestyle',
    'gaming',
    'music',
    'business',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search channels, communities...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: theme.colorScheme.surfaceContainerHighest,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(28),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 20),
              ),
              onSubmitted: (query) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Search triggered (Stub)')),
                );
              },
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Category chips
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final category = _categories[index];
                final isSelected = category == _selectedCategory;
                return FilterChip(
                  label: Text(
                    category[0].toUpperCase() + category.substring(1),
                  ),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() => _selectedCategory = category);
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Content area
          Expanded(
            child: _buildContent(theme),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(ThemeData theme) {
    // Placeholder — replace with API-driven content
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        // Featured section
        _buildSectionHeader('Featured Channels', theme),
        const SizedBox(height: 8),
        SizedBox(
          height: 160,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 5,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) => _buildFeaturedCard(theme, index),
          ),
        ),
        const SizedBox(height: 24),

        // Popular communities
        _buildSectionHeader('Popular Communities', theme),
        const SizedBox(height: 8),
        ...List.generate(6, (index) => _buildCommunityTile(theme, index)),

        // Nearby
        const SizedBox(height: 24),
        _buildSectionHeader('Near You', theme),
        const SizedBox(height: 8),
        const EmptyState(
          icon: Icons.location_on_outlined,
          title: 'Enable Location',
          subtitle: 'Allow location access to discover local communities and channels.',
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, ThemeData theme) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
        TextButton(
          onPressed: () {},
          child: const Text('See all'),
        ),
      ],
    );
  }

  Widget _buildFeaturedCard(ThemeData theme, int index) {
    final titles = ['Tech News', 'Music Hub', 'Sports Live', 'Gaming Zone', 'Daily Memes'];
    final subscribers = ['125K', '89K', '234K', '67K', '312K'];
    final colors = [Colors.blue, Colors.purple, Colors.green, Colors.orange, Colors.pink];

    return Container(
      width: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [colors[index].withOpacity(0.8), colors[index].withOpacity(0.4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          CircleAvatar(
            backgroundColor: Colors.white24,
            child: Icon(Icons.campaign, color: Colors.white.withOpacity(0.9)),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titles[index],
                style: theme.textTheme.titleSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${subscribers[index]} subscribers',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.white70,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCommunityTile(ThemeData theme, int index) {
    final names = [
      'Flutter Developers India',
      'Crypto Traders',
      'Photography Club',
      'Book Readers',
      'Startup Founders',
      'Open Source Contributors',
    ];
    final members = ['12.5K', '8.2K', '5.6K', '3.1K', '15.8K', '9.4K'];

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: theme.colorScheme.primaryContainer,
        child: Text(names[index][0]),
      ),
      title: Text(names[index]),
      subtitle: Text('${members[index]} members'),
      trailing: OutlinedButton(
        onPressed: () {},
        child: const Text('Join'),
      ),
    );
  }
}
