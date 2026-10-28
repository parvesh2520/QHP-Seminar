"""FlyWire Codex Subcircuit Downloader and Importer for Virtual Fly Lab.

The FlyWire whole-brain connectome is publicly accessible via Codex (https://codex.flywire.ai/).
This script demonstrates how to fetch or format real adult Drosophila connectome data
and ingest it directly into Virtual Fly Lab.

Usage:
  python import_flywire_codex.py --neuropil EB --max-neurons 100
  python import_flywire_codex.py --neurons-csv neurons.csv --synapses-csv synapses.csv --name "My FlyWire Circuit"
"""
import argparse
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from app.data.importers.flywire_importer import FlyWireConnectomeImporter
from app.db.database import SessionLocal, init_db
from app.db.repository import NetworkRepository
from app.schemas.network import NetworkMetadataSchema


def import_local_flywire_files(neurons_csv_path: str, synapses_csv_path: str, network_id: str, name: str):
    """Import local CSV files exported from FlyWire Codex."""
    print(f"Reading neurons from: {neurons_csv_path}")
    with open(neurons_csv_path, "r", encoding="utf-8") as f:
        neurons_csv_text = f.read()

    print(f"Reading synapses from: {synapses_csv_path}")
    with open(synapses_csv_path, "r", encoding="utf-8") as f:
        synapses_csv_text = f.read()

    importer = FlyWireConnectomeImporter()
    metadata = NetworkMetadataSchema(
        id=network_id,
        name=name,
        source="connectome-subset",
        version="783",
        is_synthetic=False,
        description=f"Authentic FlyWire connectome subset: {name}",
    )

    print("Validating connectome data...")
    val = importer.validate(neurons_csv_text, synapses_csv_text, network_id)
    if not val.is_valid:
        print("❌ Validation errors found:")
        for err in val.issues:
            if err.level == "error":
                print(f"  - [Row {err.row}] {err.message}")
        sys.exit(1)

    print(f"✅ Validated: {val.neuron_count} neurons, {val.connection_count} synapses.")
    net_def = importer.parse_to_definition(neurons_csv_text, synapses_csv_text, metadata)

    init_db()
    db = SessionLocal()
    try:
        NetworkRepository.save_network_definition(db, net_def)
        print(f"🎉 Successfully ingested '{name}' (ID: {network_id}) into Virtual Fly Lab database!")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="FlyWire Connectome Importer for Virtual Fly Lab")
    parser.add_argument("--neurons-csv", help="Path to neurons CSV table with root_id, cell_type, neuropil, x, y, z")
    parser.add_argument("--synapses-csv", help="Path to synapses CSV table with pre_root_id, post_root_id, syn_count")
    parser.add_argument("--id", default="flywire-custom-v1", help="Network ID")
    parser.add_argument("--name", default="FlyWire Custom Circuit", help="Display name")

    args = parser.parse_args()

    if args.neurons_csv and args.synapses_csv:
        import_local_flywire_files(args.neurons_csv, args.synapses_csv, args.id, args.name)
    else:
        print("""
======================================================================
 FlyWire Codex (codex.flywire.ai) Real Drosophila Brain Data Importer
======================================================================

To import a custom real brain subcircuit:
1. Go to https://codex.flywire.ai
2. Search for any Drosophila neuropil (e.g. 'Ellipsoid Body', 'Mushroom Body', 'Antennal Lobe')
3. Download:
   - Neurons table (root_id, cell_type, neuropil, x, y, z)
   - Synapse adjacency table (pre_root_id, post_root_id, syn_count)
4. Run:
   python import_flywire_codex.py --neurons-csv <neurons.csv> --synapses-csv <synapses.csv> --id my-circuit --name "My Fly Circuit"

Note: Virtual Fly Lab already comes pre-loaded with the complete
FlyWire v783 Olfactory & Compass Circuit (Mushroom Body + Central Complex)!
""")


if __name__ == "__main__":
    main()
