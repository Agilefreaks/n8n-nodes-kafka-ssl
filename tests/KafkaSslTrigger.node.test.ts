import { KafkaSslTrigger } from '../nodes/Kafka/KafkaSslTrigger.node';
import { ITriggerFunctions } from 'n8n-workflow';
import { Kafka } from 'kafkajs';

jest.mock('kafkajs', () => {
	const consumerMock = {
			connect: jest.fn().mockResolvedValue(undefined),
			disconnect: jest.fn().mockResolvedValue(undefined),
			subscribe: jest.fn().mockResolvedValue(undefined),
			run: jest.fn().mockImplementation(async ({ eachMessage }) => {
					const rawMessage = Buffer.from(JSON.stringify({ test: 'message' })); // Simulate Kafka message
					await eachMessage({
							topic: 'test-topic',
							message: { value: rawMessage },
					});
			}),
	};

	const kafkaMock = {
			consumer: jest.fn(() => consumerMock),
	};

	return {
			Kafka: jest.fn(() => kafkaMock),
			logLevel: { ERROR: 1 },
	};
});


describe('KafkaSslTrigger', () => {
    let node: KafkaSslTrigger;
    let triggerFunctions: ITriggerFunctions;

    beforeEach(() => {
        node = new KafkaSslTrigger();
        triggerFunctions = {
            getNodeParameter: jest.fn().mockImplementation((param: string) => {
                const mockParams: Record<string, any> = {
                    topic: 'test-topic',
                    groupId: 'test-group',
                    options: {},
                    useSchemaRegistry: false,
                    schemaRegistryUrl: '',
                };
                return mockParams[param];
            }),
            getCredentials: jest.fn().mockResolvedValue({
                brokers: 'localhost:9092',
                clientId: 'n8n-test',
                ssl: false,
                authentication: false,
            }),
            getNode: jest.fn().mockReturnValue({ typeVersion: 1 }),
            helpers: {
                returnJsonArray: jest.fn((data) => data),
                createDeferredPromise: jest.fn(() => {
                    let resolve: (value: any) => void;
                    const promise = new Promise((res) => (resolve = res));
                    return { promise, resolve: resolve! };
                }),
            },
            emit: jest.fn(),
        } as unknown as ITriggerFunctions;
    });

    it('should instantiate correctly', async () => {
        expect(node).toBeDefined();
    });

    it('should trigger and process messages correctly', async () => {
        const response = await node.trigger.call(triggerFunctions);
        expect(response).toHaveProperty('closeFunction');
        expect(response).toHaveProperty('manualTriggerFunction');

        expect(Kafka).toHaveBeenCalledWith({
            clientId: 'n8n-test',
            brokers: ['localhost:9092'],
            ssl: false,
            logLevel: expect.any(Number),
        });

        expect(triggerFunctions.emit).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.arrayContaining([
                    expect.objectContaining({ message: { test: 'message' } }),
                ]),
            ]),
        );
    });

    it('should disconnect the consumer on close', async () => {
        const response = await node.trigger.call(triggerFunctions);
				if (response.closeFunction) {
						await response.closeFunction();
				} else {
						fail('closeFunction is undefined');
				}
				const kafkaInstance = new Kafka({ clientId: 'test', brokers: ['localhost:9092'] });
				const consumerMock = kafkaInstance.consumer({ groupId: 'test-group' });

				if (response.closeFunction) {
						await response.closeFunction();
				} else {
						fail('closeFunction is undefined');
				}

				expect(consumerMock.disconnect).toHaveBeenCalled();
    });
});
