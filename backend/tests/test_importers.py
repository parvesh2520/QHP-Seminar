from app.data.importers.csv_importer import CsvConnectomeImporter
from app.data.importers.flywire_importer import FlyWireConnectomeImporter
from app.schemas.network import NetworkMetadataSchema


def test_csv_importer_valid():
    importer = CsvConnectomeImporter()
    neurons_csv = """id,label,class_id,hemisphere,x,y,z
N1,Neuron 1,SEN,L,0.0,0.0,0.0
N2,Neuron 2,INT,R,1.0,1.0,1.0
"""
    conns_csv = """source_id,target_id,weight,type
N1,N2,12.5,excitatory
"""
    val = importer.validate(neurons_csv, conns_csv, "test-net")
    assert val.is_valid is True
    assert val.neuron_count == 2
    assert val.connection_count == 1

    net_def = importer.parse_to_definition(
        neurons_csv,
        conns_csv,
        NetworkMetadataSchema(id="test-net", name="Test", source="csv", description="", version="1.0", is_synthetic=True),
    )
    assert len(net_def.neurons) == 2
    assert len(net_def.connections) == 1


def test_csv_importer_dangling_reference():
    importer = CsvConnectomeImporter()
    neurons_csv = """id,label
N1,Neuron 1
"""
    conns_csv = """source_id,target_id,weight
N1,N_GHOST,10.0
"""
    val = importer.validate(neurons_csv, conns_csv, "test-net")
    assert val.is_valid is False
    assert any("Unknown target neuron ID 'N_GHOST'" in i.message for i in val.issues)


def test_flywire_importer_valid():
    importer = FlyWireConnectomeImporter()
    neurons_csv = """root_id,cell_type,neuropil,hemisphere,x,y,z
720575940612345678,Mi1,OL,L,150000.0,200000.0,50000.0
720575940612345679,Tm1,OL,L,152000.0,201000.0,51000.0
"""
    synapses_csv = """pre_root_id,post_root_id,syn_count
720575940612345678,720575940612345679,16
"""
    val = importer.validate(neurons_csv, synapses_csv, "flywire-optic-subset")
    assert val.is_valid is True
    assert val.neuron_count == 2
    assert val.connection_count == 1

    net_def = importer.parse_to_definition(
        neurons_csv,
        synapses_csv,
        NetworkMetadataSchema(id="flywire-optic", name="FlyWire Optic", source="connectome-subset", description="", version="783", is_synthetic=False),
    )
    assert net_def.metadata.is_synthetic is False
    assert net_def.metadata.source == "connectome-subset"
    assert net_def.connections[0].synapse_count == 16
    assert net_def.neurons[0].id == "720575940612345678"
